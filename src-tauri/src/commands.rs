use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_autostart::ManagerExt;
use tokio_util::sync::CancellationToken;

use crate::audio::{AudioDevice, AudioRecorder};
use crate::focus::{self, FocusedApp};
use crate::format::{self, FormatIntent, FormatProvider};
use crate::store::{AppSettings, DictionaryTerm, HistoryItem, ProviderManifest, Snippet, Store};
use crate::transcribe::{create_provider, TranscribeError, TranscribeOpts};
use crate::{hotkey, inject, keychain, sync};

pub struct AppState {
    pub store: Store,
    pub audio: AudioRecorder,
    pub command_mode: AtomicBool,
    pub busy: AtomicBool,
    pub paused: AtomicBool,
    pub target_app: Mutex<Option<FocusedApp>>,
    pub last_inserted: Mutex<Option<String>>,
    pub last_shortcut: Mutex<Option<Instant>>,
    pub realtime_final: Mutex<Option<String>>,
    pub operation: Mutex<CancellationToken>,
}

impl AppState {
    pub fn new(store: Store) -> Self {
        Self {
            store,
            audio: AudioRecorder::default(),
            command_mode: AtomicBool::new(false),
            busy: AtomicBool::new(false),
            paused: AtomicBool::new(false),
            target_app: Mutex::new(None),
            last_inserted: Mutex::new(None),
            last_shortcut: Mutex::new(None),
            realtime_final: Mutex::new(None),
            operation: Mutex::new(CancellationToken::new()),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapData {
    settings: AppSettings,
    has_api_key: HashMap<String, bool>,
    devices: Vec<AudioDevice>,
    dictionary: Vec<DictionaryTerm>,
    snippets: Vec<Snippet>,
    providers: Vec<ProviderManifest>,
    platform: &'static str,
    version: &'static str,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DictationEvent<'a> {
    phase: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    level: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_code: Option<&'a str>,
}

#[tauri::command]
pub fn bootstrap(state: State<'_, AppState>) -> Result<BootstrapData, String> {
    let settings = state.store.settings().map_err(display)?;
    let providers = state.store.providers().map_err(display)?;
    let has_api_key = providers
        .iter()
        .map(|provider| {
            (
                provider.id.clone(),
                keychain::get(&provider.id).ok().flatten().is_some(),
            )
        })
        .collect();
    Ok(BootstrapData {
        settings,
        has_api_key,
        devices: AudioRecorder::devices().unwrap_or_default(),
        dictionary: state.store.dictionary().map_err(display)?,
        snippets: state.store.snippets().map_err(display)?,
        providers,
        platform: std::env::consts::OS,
        version: env!("CARGO_PKG_VERSION"),
    })
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    let previous = state.store.settings().map_err(display)?;
    state.store.validate_settings(&settings).map_err(display)?;
    hotkey::check_available(&app, &previous, &settings.hotkey.combo).map_err(display)?;
    hotkey::check_available(&app, &previous, &settings.command_hotkey).map_err(display)?;
    if let Err(error) = hotkey::register(&app, &settings) {
        let _ = hotkey::register(&app, &previous);
        return Err(display(error));
    }
    let autostart = if settings.autostart {
        app.autolaunch().enable()
    } else {
        app.autolaunch().disable()
    };
    if let Err(error) = autostart {
        let _ = hotkey::register(&app, &previous);
        return Err(display(error));
    }
    if let Err(error) = state.store.save_settings(&settings) {
        let _ = hotkey::register(&app, &previous);
        let _ = if previous.autostart {
            app.autolaunch().enable()
        } else {
            app.autolaunch().disable()
        };
        return Err(display(error));
    }
    state
        .store
        .purge_history(settings.history.retention_days)
        .map_err(display)?;
    Ok(())
}

#[tauri::command]
pub fn save_api_key(provider: String, api_key: String) -> Result<(), String> {
    keychain::set(&provider, &api_key).map_err(display)
}

#[tauri::command]
pub async fn validate_api_key(
    state: State<'_, AppState>,
    provider: String,
    api_key: Option<String>,
) -> Result<(), String> {
    let manifest = state.store.provider(&provider).map_err(display)?;
    if !manifest.requires_api_key {
        let url = format!("{}/models", manifest.base_url.trim_end_matches('/'));
        let response = reqwest::Client::new()
            .get(url)
            .timeout(Duration::from_secs(3))
            .send()
            .await
            .map_err(display);
        let response = response?;
        if !response.status().is_success() {
            return Err(format!(
                "local provider returned HTTP {}",
                response.status().as_u16()
            ));
        }
        return Ok(());
    }
    let key = api_key
        .or_else(|| keychain::get(&provider).ok().flatten())
        .context("enter an API key first")
        .map_err(display)?;
    let response = reqwest::Client::new()
        .get(format!(
            "{}/models",
            manifest.base_url.trim_end_matches('/')
        ))
        .bearer_auth(&key)
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .map_err(display)?;
    if response.status().as_u16() == 401 || response.status().as_u16() == 403 {
        return Err("API key rejected".into());
    }
    if !response.status().is_success() {
        return Err(format!(
            "provider returned HTTP {}",
            response.status().as_u16()
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    if enabled {
        app.autolaunch().enable()
    } else {
        app.autolaunch().disable()
    }
    .map_err(display)
}

#[tauri::command]
pub fn check_hotkey(
    app: AppHandle,
    state: State<'_, AppState>,
    combo: String,
) -> Result<(), String> {
    hotkey::check_available(&app, &state.store.settings().map_err(display)?, &combo)
        .map_err(display)
}

#[tauri::command]
pub fn start_recording(
    app: AppHandle,
    state: State<'_, AppState>,
    command_mode: bool,
) -> Result<(), String> {
    start(&app, &state, command_mode).map_err(|error| {
        emit_error(&app, "microphone", &error.to_string());
        display(error)
    })
}

pub fn start(app: &AppHandle, state: &AppState, command_mode: bool) -> Result<()> {
    if state.paused.load(Ordering::SeqCst) {
        anyhow::bail!("Dictum is paused from the tray");
    }
    if state.busy.swap(false, Ordering::SeqCst) {
        state.operation.lock().unwrap().cancel();
    }
    if state.audio.is_active() {
        return Ok(());
    }
    *state.operation.lock().unwrap() = CancellationToken::new();
    let settings = state.store.settings()?;
    *state.target_app.lock().unwrap() = Some(focus::current());
    state.command_mode.store(command_mode, Ordering::SeqCst);
    *state.realtime_final.lock().unwrap() = None;
    let live_tx = if settings.realtime.enabled {
        let (tx, rx) = tokio::sync::mpsc::channel(32);
        let provider = settings.realtime.provider.clone();
        let endpoint = if provider == "local" {
            settings.local_endpoint.clone()
        } else {
            state.store.provider(&provider)?.base_url
        };
        let key = keychain::get(&provider)?;
        let model = settings.realtime.model.clone();
        let realtime_app = app.clone();
        tauri::async_runtime::spawn(async move {
            run_realtime(realtime_app, provider, endpoint, model, key, rx).await;
        });
        Some(tx)
    } else {
        None
    };
    state.audio.start(
        app.clone(),
        settings.microphone_id.as_deref(),
        settings.whisper_mode,
        live_tx,
    )?;
    show_overlay(app);
    emit(
        app,
        DictationEvent {
            phase: "listening",
            level: Some(0.0),
            message: None,
            text: None,
            error_code: None,
        },
    );
    let _ = app.emit("recording:start", ());
    Ok(())
}

#[tauri::command]
pub async fn stop_recording(app: AppHandle) -> Result<(), String> {
    stop_pipeline(app).await.map_err(display)
}

pub async fn stop_pipeline(app: AppHandle) -> Result<()> {
    let state = app.state::<AppState>();
    if !state.audio.is_active() {
        return Ok(());
    }
    let _ = app.emit("recording:stop", ());
    let capture = match state.audio.stop() {
        Ok(capture) => capture,
        Err(error) => {
            emit_error(&app, "empty_audio", &error.to_string());
            hide_overlay_later(app.clone(), 1800);
            return Err(error);
        }
    };
    if state.busy.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    emit(
        &app,
        DictationEvent {
            phase: "transcribing",
            level: None,
            message: Some("Turning speech into text"),
            text: None,
            error_code: None,
        },
    );
    let result = process_capture(&app, capture).await;
    state.busy.store(false, Ordering::SeqCst);
    match &result {
        Ok(text) => {
            emit(
                &app,
                DictationEvent {
                    phase: "result",
                    level: None,
                    message: None,
                    text: Some(text),
                    error_code: None,
                },
            );
            hide_overlay_later(app.clone(), 1500);
        }
        Err(error)
            if error
                .downcast_ref::<TranscribeError>()
                .is_some_and(|error| matches!(error, TranscribeError::Cancelled)) => {}
        Err(error) => {
            emit_error(
                &app,
                error
                    .downcast_ref::<TranscribeError>()
                    .map_or("pipeline_error", TranscribeError::code),
                &error.to_string(),
            );
            hide_overlay_later(app.clone(), 2800);
        }
    }
    result.map(|_| ())
}

async fn process_capture(app: &AppHandle, capture: crate::audio::AudioCapture) -> Result<String> {
    let state = app.state::<AppState>();
    let settings = state.store.settings()?;
    let cancellation = state.operation.lock().unwrap().clone();
    let dictionary: Vec<String> = state
        .store
        .dictionary()?
        .into_iter()
        .map(|item| item.term)
        .collect();
    let manifest = state.store.provider(&settings.provider)?;
    let api_key = keychain::get(&settings.provider)?;
    if manifest.requires_api_key && api_key.is_none() {
        anyhow::bail!(TranscribeError::InvalidKey);
    }
    let provider = create_provider(
        manifest.clone(),
        api_key.clone(),
        Some(&settings.local_endpoint),
    );
    let options = TranscribeOpts {
        model: settings.model.clone(),
        language: (settings.language != "auto").then(|| settings.language.clone()),
        biasing: dictionary.clone(),
        zero_retention: settings.zero_retention,
    };
    if settings.realtime.enabled {
        tokio::time::sleep(Duration::from_millis(450)).await;
    }
    let realtime_text = state.realtime_final.lock().unwrap().take();
    let mut raw_parts = Vec::new();
    let mut cost = 0.0;
    let mut history_model = settings.model.clone();
    if let Some(text) = realtime_text.filter(|text| !text.trim().is_empty()) {
        raw_parts.push(text);
        history_model = settings.realtime.model.clone();
        if settings.realtime.provider != "local" {
            cost = capture.duration_ms as f64 / 60_000.0 * 0.006;
        }
    }
    for chunk in if raw_parts.is_empty() {
        capture.chunks.as_slice()
    } else {
        &[]
    } {
        let primary = tokio::select! { _ = cancellation.cancelled() => return Err(TranscribeError::Cancelled.into()), result = provider.transcribe(chunk, &options) => result };
        let (transcript, billed_model, billed_provider) = match primary {
            Ok(value) => (value, settings.model.clone(), settings.provider.clone()),
            Err(primary_error) => {
                if let Some(fallback_id) = &settings.fallback_provider {
                    let fallback_manifest = state.store.provider(fallback_id)?;
                    let fallback_key = keychain::get(fallback_id)?;
                    if fallback_manifest.requires_api_key && fallback_key.is_none() {
                        return Err(primary_error.into());
                    }
                    let fallback_model = fallback_manifest
                        .models
                        .iter()
                        .find(|model| *model == &settings.model)
                        .or_else(|| fallback_manifest.models.first())
                        .context("fallback provider has no model")?
                        .clone();
                    let fallback = create_provider(
                        fallback_manifest,
                        fallback_key,
                        Some(&settings.local_endpoint),
                    );
                    let mut fallback_options = options.clone();
                    fallback_options.model = fallback_model.clone();
                    let transcript = tokio::select! { _ = cancellation.cancelled() => return Err(TranscribeError::Cancelled.into()), result = fallback.transcribe(chunk, &fallback_options) => result.map_err(|_| primary_error)? };
                    (transcript, fallback_model, fallback_id.clone())
                } else {
                    return Err(primary_error.into());
                }
            }
        };
        raw_parts.push(transcript.text);
        history_model = billed_model.clone();
        cost += transcript.cost_usd.unwrap_or(estimated_cost(
            chunk.duration_ms,
            &billed_model,
            &billed_provider,
        ));
    }
    let raw = raw_parts.join(" ");
    let snippets: Vec<_> = state
        .store
        .snippets()?
        .into_iter()
        .map(|s| (s.trigger, s.expansion))
        .collect();
    let expanded = format::expand_snippets(&raw, &snippets);
    let target = state
        .target_app
        .lock()
        .unwrap()
        .clone()
        .unwrap_or_else(focus::current);
    let command_mode = state.command_mode.swap(false, Ordering::SeqCst);
    let mut replace_previous = None;
    let mut fast_inserted = None;
    let final_text = if command_mode {
        let assistant = expanded.to_lowercase().starts_with("ask dictum")
            || expanded.to_lowercase().starts_with("answer ");
        let previous = if assistant {
            None
        } else {
            Some(
                state
                    .last_inserted
                    .lock()
                    .unwrap()
                    .clone()
                    .context("there is no previous dictation to transform")?,
            )
        };
        replace_previous = previous.clone();
        emit(
            app,
            DictationEvent {
                phase: "formatting",
                level: None,
                message: Some(if assistant {
                    "Answering your question"
                } else {
                    "Applying voice command"
                }),
                text: None,
                error_code: None,
            },
        );
        let intent = if assistant {
            FormatIntent::Assistant
        } else {
            FormatIntent::Command {
                instruction: &expanded,
                previous: previous.as_deref().expect("previous text was checked"),
            }
        };
        let formatter_input = if assistant {
            format::assistant_query(&expanded)
        } else {
            &expanded
        };
        tokio::select! { _ = cancellation.cancelled() => return Err(TranscribeError::Cancelled.into()), result = format::format_text(
            formatter_input,
            &target.context,
            &dictionary,
            &settings.formatting,
            FormatProvider { manifest: &manifest, api_key: api_key.as_deref(), zero_retention: settings.zero_retention },
            intent,
        ) => result? }
    } else if settings.formatting.enabled {
        if settings.formatting.fast_insert {
            inject::inject(&expanded, &settings.injection)?;
            fast_inserted = Some(expanded.clone());
        }
        emit(
            app,
            DictationEvent {
                phase: "formatting",
                level: None,
                message: Some(if settings.formatting.fast_insert {
                    "Refining the inserted transcript"
                } else {
                    "Polishing your words"
                }),
                text: None,
                error_code: None,
            },
        );
        tokio::select! { _ = cancellation.cancelled() => return Err(TranscribeError::Cancelled.into()), result = format::format_text(
            &expanded,
            &target.context,
            &dictionary,
            &settings.formatting,
            FormatProvider { manifest: &manifest, api_key: api_key.as_deref(), zero_retention: settings.zero_retention },
            FormatIntent::Dictation,
        ) => result.unwrap_or(expanded.clone()) }
    } else {
        expanded
    };
    if cancellation.is_cancelled() {
        return Err(TranscribeError::Cancelled.into());
    }
    if let Some(previous) = replace_previous.or(fast_inserted) {
        inject::replace_previous(&final_text, &previous, &settings.injection)?;
    } else {
        inject::inject(&final_text, &settings.injection)?;
    }
    *state.last_inserted.lock().unwrap() = Some(final_text.clone());
    if settings.history.enabled {
        state.store.insert_history(
            &final_text,
            &raw,
            Some(&target.name),
            capture.duration_ms as i64,
            cost,
            &history_model,
        )?;
        state.store.purge_history(settings.history.retention_days)?;
    }
    Ok(final_text)
}

async fn run_realtime(
    app: AppHandle,
    provider: String,
    endpoint: String,
    model: String,
    key: Option<String>,
    mut audio_rx: tokio::sync::mpsc::Receiver<Vec<i16>>,
) {
    use crate::transcribe::realtime::{RealtimeDialect, RealtimeEvent, RealtimeSession};
    let Ok(session) = RealtimeSession::connect(
        &endpoint,
        &model,
        key.as_deref(),
        RealtimeDialect::for_provider(&provider),
    )
    .await
    else {
        return;
    };
    let tx = session.sender();
    let mut events = session.events;
    let mut finished = false;
    loop {
        tokio::select! {
            audio = audio_rx.recv(), if !finished => match audio { Some(samples) => { let _ = tx.send(samples).await; }, None => { let _ = tx.send(Vec::new()).await; finished = true; } },
            event = events.recv() => match event { Some(RealtimeEvent::Partial(text)) => emit(&app, DictationEvent { phase: "listening", level: None, message: None, text: Some(&text), error_code: None }), Some(RealtimeEvent::Final(text)) => { *app.state::<AppState>().realtime_final.lock().unwrap() = Some(text); break; }, Some(RealtimeEvent::Error(_)) | None => break }
        }
    }
}

fn estimated_cost(audio_ms: u64, model: &str, provider: &str) -> f64 {
    if provider == "local" {
        return 0.0;
    }
    audio_ms as f64 / 60_000.0
        * if model.contains("small-24b") {
            0.006
        } else {
            0.003
        }
}

#[tauri::command]
pub fn cancel_recording(app: AppHandle, state: State<'_, AppState>) {
    cancel(&app, &state);
}

pub fn cancel(app: &AppHandle, state: &AppState) {
    state.audio.cancel();
    state.operation.lock().unwrap().cancel();
    state.busy.store(false, Ordering::SeqCst);
    state.command_mode.store(false, Ordering::SeqCst);
    emit(
        app,
        DictationEvent {
            phase: "cancelled",
            level: None,
            message: None,
            text: None,
            error_code: None,
        },
    );
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.hide();
    }
    let _ = app.emit("recording:cancel", ());
}

#[tauri::command]
pub fn get_history(state: State<'_, AppState>, search: String) -> Result<Vec<HistoryItem>, String> {
    state.store.history(&search).map_err(display)
}
#[tauri::command]
pub fn delete_history(state: State<'_, AppState>, id: Option<i64>) -> Result<(), String> {
    state.store.delete_history(id).map_err(display)
}
#[tauri::command]
pub fn copy_text(text: String) -> Result<(), String> {
    inject::copy(&text).map_err(display)
}
#[tauri::command]
pub fn add_dictionary_term(state: State<'_, AppState>, term: String) -> Result<(), String> {
    state
        .store
        .add_dictionary(term.trim(), "manual")
        .map_err(display)
}
#[tauri::command]
pub fn remove_dictionary_term(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.store.remove_dictionary(id).map_err(display)
}
#[tauri::command]
pub fn learn_correction(
    state: State<'_, AppState>,
    original: String,
    corrected: String,
) -> Result<Vec<String>, String> {
    let learned = correction_terms(&original, &corrected);
    for word in &learned {
        state.store.add_dictionary(word, "auto").map_err(display)?;
    }
    Ok(learned)
}
#[tauri::command]
pub fn save_snippet(
    state: State<'_, AppState>,
    id: Option<i64>,
    trigger: String,
    expansion: String,
) -> Result<(), String> {
    state
        .store
        .save_snippet(id, trigger.trim(), expansion.trim())
        .map_err(display)
}
#[tauri::command]
pub fn remove_snippet(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.store.remove_snippet(id).map_err(display)
}
#[tauri::command]
pub fn save_provider(state: State<'_, AppState>, manifest: ProviderManifest) -> Result<(), String> {
    state.store.save_provider(&manifest).map_err(display)
}

#[tauri::command]
pub async fn run_sync(
    state: State<'_, AppState>,
    direction: String,
    password: String,
) -> Result<(), String> {
    let settings = state.store.settings().map_err(display)?.sync;
    let result = match direction.as_str() {
        "push" => sync::push(&state.store, &settings, &password).await,
        "pull" => sync::pull(&state.store, &settings, &password).await,
        _ => Err(anyhow::anyhow!("invalid sync direction")),
    };
    result.map_err(display)
}

#[tauri::command]
pub fn open_permissions(kind: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let url = match kind.as_str() {
            "microphone" => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
            }
            "inputMonitoring" => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"
            }
            _ => "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
        };
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(display)?;
    }
    #[cfg(windows)]
    {
        let url = if kind == "microphone" {
            "ms-settings:privacy-microphone"
        } else {
            "ms-settings:easeofaccess-keyboard"
        };
        std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map_err(display)?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let _ = kind;
    }
    Ok(())
}

fn emit<T: Serialize + Clone>(app: &AppHandle, payload: T) {
    let _ = app.emit("dictation:state", payload);
}
fn emit_error(app: &AppHandle, code: &str, message: &str) {
    show_overlay(app);
    emit(
        app,
        DictationEvent {
            phase: "error",
            level: None,
            message: Some(message),
            text: None,
            error_code: Some(code),
        },
    );
}
fn show_overlay(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.show();
        let _ = window.set_ignore_cursor_events(false);
    }
}
fn hide_overlay_later(app: AppHandle, delay: u64) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(delay)).await;
        if let Some(window) = app.get_webview_window("overlay") {
            let _ = window.hide();
        }
        emit(
            &app,
            DictationEvent {
                phase: "idle",
                level: None,
                message: None,
                text: None,
                error_code: None,
            },
        );
    });
}
fn display(error: impl std::fmt::Display) -> String {
    error.to_string()
}
fn normalize_word(word: &str) -> String {
    word.trim_matches(|c: char| !c.is_alphanumeric() && c != '-' && c != '_')
        .to_string()
}
fn correction_terms(original: &str, corrected: &str) -> Vec<String> {
    let old: Vec<_> = original.split_whitespace().map(normalize_word).collect();
    corrected
        .split_whitespace()
        .map(normalize_word)
        .enumerate()
        .filter_map(|(index, word)| {
            (word.len() > 1 && old.get(index) != Some(&word) && !old.contains(&word))
                .then_some(word)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_transcription_has_no_inference_cost() {
        assert_eq!(estimated_cost(60_000, "any-model", "local"), 0.0);
    }

    #[test]
    fn hosted_default_uses_duration_estimate() {
        assert_eq!(estimated_cost(60_000, "voxtral-mini", "openrouter"), 0.003);
    }

    #[test]
    fn learns_new_terms_from_a_user_correction() {
        assert_eq!(
            correction_terms("Meet Victor at noon", "Meet Viktor at noon"),
            vec!["Viktor"]
        );
    }
}
