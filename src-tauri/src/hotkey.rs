use std::{
    str::FromStr,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, Once,
    },
    time::{Duration, Instant},
};

use anyhow::{Context, Result};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

use crate::commands::{self, AppState};
use crate::store::AppSettings;

static KEYBOARD_LISTENER: Once = Once::new();
static LAST_SHIFT: Mutex<Option<Instant>> = Mutex::new(None);
static SHIFT_HELD: AtomicBool = AtomicBool::new(false);

pub fn validate(combo: &str) -> Result<()> {
    let shortcut = Shortcut::from_str(combo).context("invalid shortcut")?;
    anyhow::ensure!(
        shortcut != cancel_shortcut()?,
        "Escape is reserved for cancelling a recording"
    );
    Ok(())
}

pub fn check_available(app: &AppHandle, settings: &AppSettings, combo: &str) -> Result<()> {
    let candidate = Shortcut::from_str(combo).context("invalid shortcut")?;
    let current = Shortcut::from_str(&settings.hotkey.combo).ok();
    let command = Shortcut::from_str(&settings.command_hotkey).ok();
    if current.as_ref() == Some(&candidate) || command.as_ref() == Some(&candidate) {
        return Ok(());
    }
    anyhow::ensure!(
        !app.global_shortcut().is_registered(candidate),
        "shortcut is already registered"
    );
    app.global_shortcut()
        .register(candidate)
        .context("shortcut conflicts with another application or the operating system")?;
    app.global_shortcut().unregister(candidate)?;
    Ok(())
}

pub fn register(app: &AppHandle, settings: &AppSettings) -> Result<()> {
    let command =
        Shortcut::from_str(&settings.command_hotkey).context("invalid command shortcut")?;
    if settings.hotkey.mode != "doubleTap" {
        let dictation =
            Shortcut::from_str(&settings.hotkey.combo).context("invalid dictation shortcut")?;
        anyhow::ensure!(
            dictation != command,
            "dictation and command shortcuts must be different"
        );
    }
    app.global_shortcut().unregister_all()?;
    if settings.hotkey.mode != "doubleTap" {
        app.global_shortcut().register(
            Shortcut::from_str(&settings.hotkey.combo).context("invalid dictation shortcut")?,
        )?;
    }
    app.global_shortcut().register(command)?;
    // Do not register or unregister another global shortcut from this callback's call path:
    // on Windows that re-entrant operation can deadlock the shortcut manager as soon as the
    // dictation shortcut is pressed. Escape and the optional double tap are observed here
    // instead because neither can be expressed safely as a normal Dictum shortcut.
    start_keyboard_listener(app.clone());
    Ok(())
}

fn cancel_shortcut() -> Result<Shortcut> {
    Shortcut::from_str("Escape").context("could not create the cancel shortcut")
}

pub fn handle(app: &AppHandle, shortcut: &Shortcut, event: ShortcutEvent) {
    let state = app.state::<AppState>();
    let Ok(settings) = state.store.settings() else {
        return;
    };
    let command = Shortcut::from_str(&settings.command_hotkey).ok().as_ref() == Some(shortcut);
    if command {
        if event.state() == ShortcutState::Pressed && debounced(&state) {
            if state.audio.is_active() {
                tauri::async_runtime::spawn(commands::stop_pipeline(app.clone()));
            } else {
                let _ = commands::start(app, &state, true);
            }
        }
        return;
    }
    if settings.hotkey.mode == "hold" {
        match event.state() {
            ShortcutState::Pressed => {
                let _ = commands::start(app, &state, false);
            }
            ShortcutState::Released => {
                tauri::async_runtime::spawn(commands::stop_pipeline(app.clone()));
            }
        }
    } else if event.state() == ShortcutState::Pressed && debounced(&state) {
        if state.audio.is_active() {
            tauri::async_runtime::spawn(commands::stop_pipeline(app.clone()));
        } else {
            let _ = commands::start(app, &state, false);
        }
    }
}

fn debounced(state: &AppState) -> bool {
    let now = Instant::now();
    let mut last = state.last_shortcut.lock().unwrap();
    if last.is_some_and(|value| now.duration_since(value) < Duration::from_millis(220)) {
        return false;
    }
    *last = Some(now);
    true
}

fn start_keyboard_listener(app: AppHandle) {
    KEYBOARD_LISTENER.call_once(|| {
        std::thread::spawn(move || {
            let listener_app = app.clone();
            let result = rdev::listen(move |event| {
                if matches!(
                    event.event_type,
                    rdev::EventType::KeyPress(rdev::Key::Escape)
                ) {
                    let state = listener_app.state::<AppState>();
                    if state.audio.is_active() {
                        commands::cancel(&listener_app, &state);
                    }
                    return;
                }
                if matches!(
                    event.event_type,
                    rdev::EventType::KeyRelease(rdev::Key::ShiftRight)
                ) {
                    SHIFT_HELD.store(false, Ordering::SeqCst);
                    return;
                }
                if !matches!(
                    event.event_type,
                    rdev::EventType::KeyPress(rdev::Key::ShiftRight)
                ) {
                    return;
                }
                if SHIFT_HELD.swap(true, Ordering::SeqCst) {
                    return;
                }
                let now = Instant::now();
                let mut last = LAST_SHIFT.lock().unwrap();
                let double = is_double_tap(&mut last, now);
                drop(last);
                if !double {
                    return;
                }
                let state = listener_app.state::<AppState>();
                if state
                    .store
                    .settings()
                    .map(|s| s.hotkey.mode == "doubleTap")
                    .unwrap_or(false)
                {
                    if state.audio.is_active() {
                        tauri::async_runtime::spawn(commands::stop_pipeline(listener_app.clone()));
                    } else {
                        let _ = commands::start(&listener_app, &state, false);
                    }
                }
            });
            if let Err(error) = result {
                let state = app.state::<AppState>();
                if let Ok(mut settings) = state.store.settings() {
                    settings.hotkey.mode = "hold".into();
                    let _ = state.store.save_settings(&settings);
                    let _ = register(&app, &settings);
                }
                let _ = app.emit("dictation:state", serde_json::json!({"phase":"error","errorCode":"input_monitoring","message":format!("Low-level shortcut access unavailable; reverted to hold-to-talk: {error:?}")}));
            }
        });
    });
}

fn is_double_tap(last: &mut Option<Instant>, now: Instant) -> bool {
    let double = last.is_some_and(|value| now.duration_since(value) <= Duration::from_millis(350));
    *last = if double { None } else { Some(now) };
    double
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escape_is_reserved_for_cancelling_a_recording() {
        assert!(validate("Escape").is_err());
        assert!(validate("CommandOrControl+Shift+Space").is_ok());
    }

    #[test]
    fn triple_press_produces_only_one_double_tap() {
        let start = Instant::now();
        let mut last = None;
        assert!(!is_double_tap(&mut last, start));
        assert!(is_double_tap(&mut last, start + Duration::from_millis(100)));
        assert!(!is_double_tap(
            &mut last,
            start + Duration::from_millis(200)
        ));
    }
}
