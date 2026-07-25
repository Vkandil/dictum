use std::{
    borrow::Cow,
    sync::{Mutex, OnceLock},
    thread,
    time::Duration,
};

use anyhow::{Context, Result};
use arboard::{Clipboard, ImageData};
use enigo::{Direction, Enigo, Key, Keyboard, Settings};

enum SavedClipboard {
    Text(String),
    Image {
        width: usize,
        height: usize,
        bytes: Vec<u8>,
    },
    Empty,
}

/// Two dictations pasted back to back (or a command-mode replace right after a dictation) can
/// each call paste() within the same restore window. Each call used to independently save/
/// restore the clipboard, so a later call could capture an *earlier call's dictated text* as
/// "the clipboard to restore" instead of the user's real previous clipboard - and whichever
/// restore timer fired last won, leaving stray dictated text behind instead of what was there
/// before any of them ran. Track the one true original centrally: only the first paste() in a
/// burst records it, and only the most recent paste()'s restore timer is allowed to act on it.
struct PendingRestore {
    generation: u64,
    original: Option<SavedClipboard>,
}

fn pending_restore() -> &'static Mutex<PendingRestore> {
    static PENDING: OnceLock<Mutex<PendingRestore>> = OnceLock::new();
    PENDING.get_or_init(|| {
        Mutex::new(PendingRestore {
            generation: 0,
            original: None,
        })
    })
}

pub fn inject(text: &str, mode: &str) -> Result<()> {
    match mode {
        "keystroke" => type_text(text),
        _ => paste(text).or_else(|_| type_text(text)),
    }
}

pub fn replace_previous(text: &str, previous: &str, mode: &str) -> Result<()> {
    let mut enigo =
        Enigo::new(&Settings::default()).context("could not initialize system input")?;
    enigo.key(Key::Shift, Direction::Press)?;
    let length = previous.encode_utf16().count();
    let mut selection = Ok(());
    for _ in 0..length {
        if let Err(error) = enigo.key(Key::LeftArrow, Direction::Click) {
            selection = Err(anyhow::Error::from(error));
            break;
        }
    }
    let released = enigo.key(Key::Shift, Direction::Release);
    selection?;
    released?;
    inject(text, mode)
}

/// Applies only the visible difference between what's currently typed at the cursor and a
/// new target text, via Backspace-then-type - never the clipboard, never a synthetic
/// Shift+selection. Used to keep realtime live captions appearing directly in the target
/// document as they're recognized (instead of only in the HUD) without repeating the
/// clipboard-paste-over-a-selection dance many times a second - that mechanism is what made
/// "Fast insert, then refine" occasionally duplicate text, and doing it on every delta would
/// hit the same risk far more often. Since deltas are almost always pure appends, the common
/// case costs nothing to delete and just types the new suffix.
pub fn live_update(previous: &str, next: &str) -> Result<()> {
    if previous == next {
        return Ok(());
    }
    let prefix_len = common_prefix_len(previous, next);
    let to_delete = previous[prefix_len..].encode_utf16().count();
    let mut enigo =
        Enigo::new(&Settings::default()).context("could not initialize system input")?;
    for _ in 0..to_delete {
        let _ = enigo.key(Key::Backspace, Direction::Click);
    }
    let suffix = &next[prefix_len..];
    if !suffix.is_empty() {
        enigo.text(suffix).context("synthetic typing failed")?;
    }
    Ok(())
}

fn common_prefix_len(a: &str, b: &str) -> usize {
    let mut len = 0;
    for (ca, cb) in a.chars().zip(b.chars()) {
        if ca != cb {
            break;
        }
        len += ca.len_utf8();
    }
    len
}

pub fn copy(text: &str) -> Result<()> {
    Clipboard::new()?
        .set_text(text)
        .context("could not write to clipboard")
}

// How long to wait before restoring the user's previous clipboard content. Many apps
// (Electron/Chromium-based editors especially - Slack, Notion, Discord, Teams) don't read
// the clipboard synchronously off the native paste event; they re-read it asynchronously,
// sometimes 100ms+ later. Restoring on a short fixed timer raced that read: if it fired
// after we'd already put the old content back, the app pasted the old text instead of (or
// mixed with) the dictated text. Restoring well after the fact, off the critical path,
// gives virtually any app time to finish before we touch the clipboard again.
const RESTORE_DELAY: Duration = Duration::from_millis(2000);

fn paste(text: &str) -> Result<()> {
    let mut clipboard = Clipboard::new().context("could not open clipboard")?;
    let current = if let Ok(value) = clipboard.get_text() {
        SavedClipboard::Text(value)
    } else if let Ok(image) = clipboard.get_image() {
        SavedClipboard::Image {
            width: image.width,
            height: image.height,
            bytes: image.bytes.into_owned(),
        }
    } else {
        SavedClipboard::Empty
    };
    let generation = {
        let mut pending = pending_restore().lock().unwrap();
        if pending.original.is_none() {
            pending.original = Some(current);
        }
        pending.generation += 1;
        pending.generation
    };
    clipboard
        .set_text(text)
        .context("could not prepare clipboard paste")?;
    thread::sleep(Duration::from_millis(20));
    let mut enigo =
        Enigo::new(&Settings::default()).context("could not initialize system input")?;
    let modifier = Key::Control;
    // Once we start sending the paste keystroke we're committed: a failure here (e.g.
    // releasing the modifier key) must NOT make this function return Err. `inject()` treats
    // any Err from paste() as "nothing was inserted" and retypes the whole text as a
    // fallback - but if Ctrl+V had already reached the target app, that fallback duplicated
    // the text instead of recovering from a real failure.
    let _ = enigo.key(modifier, Direction::Press);
    let _ = enigo.key(Key::Unicode('v'), Direction::Click);
    let _ = enigo.key(modifier, Direction::Release);
    thread::spawn(move || {
        thread::sleep(RESTORE_DELAY);
        let mut pending = pending_restore().lock().unwrap();
        if pending.generation != generation {
            // A later paste() has since taken over; its own timer will do the restore.
            return;
        }
        let Some(original) = pending.original.take() else {
            return;
        };
        drop(pending);
        let Ok(mut clipboard) = Clipboard::new() else {
            return;
        };
        let _ = match original {
            SavedClipboard::Text(value) => clipboard.set_text(value),
            SavedClipboard::Image {
                width,
                height,
                bytes,
            } => clipboard.set_image(ImageData {
                width,
                height,
                bytes: Cow::Owned(bytes),
            }),
            SavedClipboard::Empty => Ok(()),
        };
    });
    Ok(())
}

fn type_text(text: &str) -> Result<()> {
    let mut enigo =
        Enigo::new(&Settings::default()).context("could not initialize system input")?;
    enigo.text(text).context("synthetic typing failed")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn common_prefix_stops_at_first_difference() {
        assert_eq!(
            common_prefix_len("hello wor", "hello world"),
            "hello wor".len()
        );
        assert_eq!(
            common_prefix_len("hello world", "hello word"),
            "hello wor".len()
        );
        assert_eq!(common_prefix_len("", "hello"), 0);
        assert_eq!(common_prefix_len("hello", "hello"), "hello".len());
    }

    #[test]
    fn common_prefix_does_not_split_multibyte_characters() {
        // "café" / "café2" share "café" (4 chars, 5 bytes since é is 2 bytes in UTF-8).
        assert_eq!(common_prefix_len("café", "café2"), "café".len());
        assert_eq!(common_prefix_len("bonjour", "bonjour"), "bonjour".len());
    }
}
