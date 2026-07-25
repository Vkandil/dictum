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

/// "Fast insert, then refine" pastes twice in quick succession: the raw transcript, then the
/// polished text over it a moment later. Each paste() used to independently save/restore the
/// clipboard, so the second call captured the *first call's dictated text* as "the clipboard to
/// restore" instead of the user's real previous clipboard - and whichever restore timer fired
/// last won, leaving stray dictated text in the clipboard instead of what was there before
/// either paste ever ran. Track the one true original centrally: only the first paste() in a
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
