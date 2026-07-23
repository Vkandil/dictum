use std::{borrow::Cow, thread, time::Duration};

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
    let saved = if let Ok(value) = clipboard.get_text() {
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
    clipboard
        .set_text(text)
        .context("could not prepare clipboard paste")?;
    thread::sleep(Duration::from_millis(20));
    let mut enigo =
        Enigo::new(&Settings::default()).context("could not initialize system input")?;
    let modifier = Key::Control;
    enigo.key(modifier, Direction::Press)?;
    enigo.key(Key::Unicode('v'), Direction::Click)?;
    enigo.key(modifier, Direction::Release)?;
    thread::spawn(move || {
        thread::sleep(RESTORE_DELAY);
        let Ok(mut clipboard) = Clipboard::new() else {
            return;
        };
        let _ = match saved {
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
