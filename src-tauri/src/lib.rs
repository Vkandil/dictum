#[cfg(not(target_os = "windows"))]
compile_error!("Dictum 1.0 supports Windows only.");

pub mod audio;
pub mod commands;
pub mod focus;
pub mod format;
pub mod hotkey;
pub mod inject;
pub mod keychain;
pub mod store;
pub mod sync;
pub mod transcribe;

use std::sync::atomic::Ordering;

use anyhow::Result;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::Builder as ShortcutBuilder;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
#[cfg(not(debug_assertions))]
use tauri_plugin_updater::UpdaterExt;

use commands::AppState;
use store::Store;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .arg("--hidden")
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(ShortcutBuilder::new().with_handler(hotkey::handle).build())
        .setup(|app| {
            let store = Store::new()?;
            let settings = store.settings()?;
            // Non-critical: never let history maintenance or tray setup abort startup.
            let _ = store.purge_history(settings.history.retention_days);
            app.manage(AppState::new(store));
            let _ = setup_tray(app);
            let _ = hotkey::register(app.handle(), &settings);
            #[cfg(not(debug_assertions))]
            {
                let update_app = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let Ok(updater) = update_app.updater() else {
                        return;
                    };
                    let Ok(Some(update)) = updater.check().await else {
                        return;
                    };
                    if update.download_and_install(|_, _| {}, || {}).await.is_ok() {
                        update_app.restart();
                    }
                });
            }
            if std::env::args().any(|arg| arg == "--hidden") {
                if let Some(window) = app.get_webview_window("main") {
                    window.hide()?;
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap,
            commands::save_settings,
            commands::save_api_key,
            commands::validate_api_key,
            commands::set_autostart,
            commands::start_mic_test,
            commands::stop_mic_test,
            commands::check_hotkey,
            commands::start_recording,
            commands::stop_recording,
            commands::cancel_recording,
            commands::get_history,
            commands::delete_history,
            commands::copy_text,
            commands::add_dictionary_term,
            commands::remove_dictionary_term,
            commands::learn_correction,
            commands::save_snippet,
            commands::remove_snippet,
            commands::save_provider,
            commands::run_sync,
            commands::open_permissions
        ])
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run Dictum");
}

fn setup_tray(app: &mut tauri::App) -> Result<()> {
    let show = MenuItem::with_id(app, "show", "Open Dictum", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "Pause dictation", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &settings, &pause, &quit])?;
    let pause_item = pause.clone();
    let mut tray = TrayIconBuilder::with_id("dictum-tray")
        .tooltip("Dictum — ready")
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "settings" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("navigation:settings", ());
                }
            }
            "pause" => {
                let state = app.state::<AppState>();
                let paused = !state.paused.load(Ordering::SeqCst);
                state.paused.store(paused, Ordering::SeqCst);
                let _ = pause_item.set_text(if paused {
                    "Resume dictation"
                } else {
                    "Pause dictation"
                });
                if paused {
                    state.audio.cancel();
                    let _ = app.global_shortcut().unregister_all();
                } else if let Ok(settings) = state.store.settings() {
                    let _ = hotkey::register(app, &settings);
                }
            }
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}
