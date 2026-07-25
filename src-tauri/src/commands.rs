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
    pub realtime_done: Mutex<Option<tokio::sync::oneshot::Receiver<()>>>,
    pub realtime_live: Mutex<Option<String>>,
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
            realtime_done: Mutex::new(None),
            realtime_live: Mutex::new(None),
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
    let autostart_changed = settings.autostart != previous.autostart;
    if autostart_changed {
        let autostart = if settings.autostart {
            app.autolaunch().enable()
        } else {
            app.autolaunch().disable()
        };
        if let Err(error) = autostart {
            let _ = hotkey::register(&app, &previous);
            return Err(display(error));
        }
    }
    if let Err(error) = state.store.save_settings(&settings) {
        let _ = hotkey::register(&app, &previous);
        if autostart_changed {
            let _ = if previous.autostart {
                app.autolaunch().enable()
            } else {
                app.autolaunch().disable()
            };
        }
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
    *state.realtime_done.lock().unwrap() = None;
    *state.realtime_live.lock().unwrap() = None;
    let live_tx = if settings.realtime.enabled {
        let (tx, rx) = tokio::sync::mpsc::channel(32);
        let (done_tx, done_rx) = tokio::sync::oneshot::channel();
        *state.realtime_done.lock().unwrap() = Some(done_rx);
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
            run_realtime(realtime_app, provider, endpoint, model, key, rx, done_tx).await;
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
        // Wait for the realtime session to signal it's done (final transcript, error, or
        // exhausted reconnects) rather than a fixed guess. Bounded so a hung connection
        // can't stall the dictation indefinitely - it just falls back to batch transcription.
        let done_rx = state.realtime_done.lock().unwrap().take();
        if let Some(done_rx) = done_rx {
            let _ = tokio::time::timeout(Duration::from_secs(4), done_rx).await;
        }
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
    let chunks = if raw_parts.is_empty() {
        capture.chunks.as_slice()
    } else {
        &[]
    };
    // Transcribe every part concurrently instead of awaiting them one at a time - a long
    // dictation with several parts no longer takes N times as long as a single request.
    // The "part X of Y" progress wording is intentionally gone: the caller already shows
    // "Turning speech into text" once, and the user shouldn't need to know internally that
    // their recording was split at all.
    let outcomes = futures_util::future::join_all(chunks.iter().map(|chunk| {
        let options = &options;
        let cancellation = &cancellation;
        let provider = provider.as_ref();
        let state = &state;
        let settings = &settings;
        async move {
            let primary = tokio::select! { _ = cancellation.cancelled() => return Err(TranscribeError::Cancelled.into()), result = provider.transcribe(chunk, options) => result };
            match primary {
                Ok(value) => Ok((value, settings.model.clone(), settings.provider.clone())),
                Err(primary_error) => {
                    if let Some(fallback_id) = &settings.fallback_provider {
                        let fallback_manifest = state.store.provider(fallback_id)?;
                        let fallback_key = keychain::get(fallback_id)?;
                        if fallback_manifest.requires_api_key && fallback_key.is_none() {
                            return Err(anyhow::Error::new(primary_error)
                                .context("transcription part failed"));
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
                        let transcript = tokio::select! { _ = cancellation.cancelled() => return Err(TranscribeError::Cancelled.into()), result = fallback.transcribe(chunk, &fallback_options) => result };
                        let transcript = transcript.map_err(|_| {
                            anyhow::Error::new(primary_error)
                                .context("transcription part failed")
                        })?;
                        emit(
                            app,
                            DictationEvent {
                                phase: "transcribing",
                                level: None,
                                message: Some("Switched to your backup provider"),
                                text: None,
                                error_code: None,
                            },
                        );
                        Ok((transcript, fallback_model, fallback_id.clone()))
                    } else {
                        Err(anyhow::Error::new(primary_error).context("transcription part failed"))
                    }
                }
            }
        }
    }))
    .await;
    for (chunk, outcome) in chunks.iter().zip(outcomes) {
        let (transcript, billed_model, billed_provider) = outcome?;
        raw_parts.push(transcript.text);
        history_model = billed_model.clone();
        cost += transcript.cost_usd.unwrap_or(estimated_cost(
            chunk.duration_ms,
            &billed_model,
            &billed_provider,
        ));
    }
    let raw = combine_transcript_parts(&raw_parts);
    let snippets: Vec<_> = state
        .store
        .snippets()?
        .into_iter()
        .map(|s| (s.trigger, s.expansion))
        .collect();
    let (expanded, snippet_fired) = format::expand_snippets(&raw, &snippets);
    // When a snippet fires and verbatim insertion is enabled, insert the expansion exactly as
    // configured — skip AI formatting so it can't reword an email, signature, or code block.
    let skip_formatting = snippet_fired && settings.snippets_verbatim;
    let target = state
        .target_app
        .lock()
        .unwrap()
        .clone()
        .unwrap_or_else(focus::current);
    let command_mode = state.command_mode.swap(false, Ordering::SeqCst);
    let mut replace_previous = None;
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
    } else if settings.formatting.enabled && !skip_formatting {
        emit(
            app,
            DictationEvent {
                phase: "formatting",
                level: None,
                message: Some("Polishing your words"),
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
    if let Some(previous) = replace_previous {
        inject::replace_previous(&final_text, &previous, &settings.injection)?;
    } else if let Some(live) = state.realtime_live.lock().unwrap().take() {
        // Realtime already typed the recognized text live at the cursor as it arrived;
        // reconcile with only the difference (e.g. AI formatting's polish) instead of
        // inserting a second copy on top of it.
        inject::live_update(&live, &final_text)?;
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

fn combine_transcript_parts(parts: &[String]) -> String {
    parts
        .iter()
        .map(|part| part.trim())
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

const REALTIME_MAX_ATTEMPTS: u8 = 3;
// The HUD is a small, fixed-size window; keep a server error readable within it instead of
// letting a long validation-error payload overflow past its bounds.
const REALTIME_ERROR_PREVIEW_CHARS: usize = 150;

fn truncate_reason(reason: &str) -> String {
    if reason.chars().count() <= REALTIME_ERROR_PREVIEW_CHARS {
        reason.to_string()
    } else {
        let truncated: String = reason.chars().take(REALTIME_ERROR_PREVIEW_CHARS).collect();
        format!("{truncated}…")
    }
}

/// Streams microphone audio to a realtime transcription session and relays partial/final
/// text back to the UI. Unlike the original version, failures are never silent: a failed
/// or dropped connection surfaces a short notice (via the "listening" phase's `message`)
/// instead of quietly falling back to batch transcription with no explanation. A mid-stream
/// drop is retried a bounded number of times, carrying the transcript accumulated so far
/// forward as a prefix so a reconnect doesn't lose what was already recognized.
async fn run_realtime(
    app: AppHandle,
    provider: String,
    endpoint: String,
    model: String,
    key: Option<String>,
    mut audio_rx: tokio::sync::mpsc::Receiver<Vec<i16>>,
    done: tokio::sync::oneshot::Sender<()>,
) {
    use crate::transcribe::realtime::{RealtimeDialect, RealtimeEvent, RealtimeSession};
    let dialect = RealtimeDialect::for_provider(&provider);
    let mut transcript = String::new();
    let mut finished = false;
    let mut attempt = 0u8;
    loop {
        let session =
            match RealtimeSession::connect(&endpoint, &model, key.as_deref(), dialect).await {
                Ok(session) => session,
                Err(_) => {
                    let notice = if attempt == 0 {
                        "Realtime unavailable — recording normally"
                    } else {
                        "Realtime connection lost — recording normally"
                    };
                    emit(
                        &app,
                        DictationEvent {
                            phase: "listening",
                            level: None,
                            message: Some(notice),
                            text: None,
                            error_code: None,
                        },
                    );
                    break;
                }
            };
        attempt += 1;
        let tx = session.sender();
        let mut events = session.events;
        let prefix = transcript.clone();
        let mut last_error: Option<String> = None;
        loop {
            tokio::select! {
                audio = audio_rx.recv(), if !finished => match audio {
                    Some(samples) => { let _ = tx.send(samples).await; }
                    None => { let _ = tx.send(Vec::new()).await; finished = true; }
                },
                event = events.recv() => match event {
                    Some(RealtimeEvent::Partial(text)) => {
                        transcript = format!("{prefix}{text}");
                        // Type the live transcript directly at the cursor instead of only
                        // showing it in the HUD - skipped in command mode, where the spoken
                        // words are an instruction, not literal text to insert. Only ever
                        // *appends*: if the new transcript isn't a pure extension of what's
                        // already on screen (Voxtral revising a word), leave the screen as-is
                        // rather than risk a live Backspace-based fixup racing the target app -
                        // the Final handler below always does one clean reconciliation pass.
                        let state = app.state::<AppState>();
                        if !state.command_mode.load(Ordering::SeqCst) {
                            let mut live = state.realtime_live.lock().unwrap();
                            let previous = live.clone().unwrap_or_default();
                            if let Some(suffix) = transcript.strip_prefix(previous.as_str()) {
                                if !suffix.is_empty() {
                                    *live = Some(transcript.clone());
                                    drop(live);
                                    let _ = inject::type_only(suffix);
                                }
                            }
                        }
                    }
                    Some(RealtimeEvent::Final(text)) => {
                        transcript = format!("{prefix}{text}");
                        let state = app.state::<AppState>();
                        if !state.command_mode.load(Ordering::SeqCst) {
                            let mut live = state.realtime_live.lock().unwrap();
                            let previous = live.clone().unwrap_or_default();
                            *live = Some(transcript.clone());
                            drop(live);
                            let _ = inject::live_update(&previous, &transcript);
                        }
                        *state.realtime_final.lock().unwrap() = Some(transcript);
                        let _ = done.send(());
                        return;
                    }
                    Some(RealtimeEvent::Error(reason)) => { last_error = Some(reason); break; }
                    None => break,
                }
            }
        }
        if finished || attempt >= REALTIME_MAX_ATTEMPTS {
            if !finished {
                let notice = match &last_error {
                    Some(reason) => format!(
                        "Realtime connection lost ({}) — recording normally",
                        truncate_reason(reason)
                    ),
                    None => "Realtime connection lost — recording normally".to_string(),
                };
                emit(
                    &app,
                    DictationEvent {
                        phase: "listening",
                        level: None,
                        message: Some(&notice),
                        text: None,
                        error_code: None,
                    },
                );
            }
            break;
        }
        let notice = match &last_error {
            Some(reason) => format!(
                "Realtime connection lost ({}) — reconnecting…",
                truncate_reason(reason)
            ),
            None => "Realtime connection lost — reconnecting…".to_string(),
        };
        emit(
            &app,
            DictationEvent {
                phase: "listening",
                level: None,
                message: Some(&notice),
                text: None,
                error_code: None,
            },
        );
        tokio::time::sleep(Duration::from_millis(300)).await;
    }
    let _ = done.send(());
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
    if let Some(live) = state.realtime_live.lock().unwrap().take() {
        // Realtime may have already typed the in-progress transcript at the cursor; cancelling
        // must mean nothing gets inserted, so remove it rather than leaving it behind.
        let _ = inject::live_update(&live, "");
    }
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
    auth_password: Option<String>,
) -> Result<(), String> {
    let settings = state.store.settings().map_err(display)?.sync;
    let auth = auth_password.as_deref().filter(|value| !value.is_empty());
    let result = match direction.as_str() {
        "push" => sync::push(&state.store, &settings, &password, auth).await,
        "pull" => sync::pull(&state.store, &settings, &password, auth).await,
        _ => Err(anyhow::anyhow!("invalid sync direction")),
    };
    result.map_err(display)
}

#[tauri::command]
pub fn open_permissions(kind: String) -> Result<(), String> {
    let url = if kind == "microphone" {
        "ms-settings:privacy-microphone"
    } else {
        "ms-settings:easeofaccess-keyboard"
    };
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(display)?;
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
#[derive(PartialEq)]
enum DiffOp {
    Match,
    Delete,
    Insert,
}

/// Word-level diff via LCS backtracking. Unlike a positional (index-by-index) comparison,
/// this stays aligned when the user's correction adds or removes words instead of only
/// swapping one word for another, so a diff op reflects a real edit rather than a shift.
fn diff_ops(old: &[String], new: &[String]) -> Vec<DiffOp> {
    let (n, m) = (old.len(), new.len());
    let mut table = vec![vec![0u32; m + 1]; n + 1];
    for i in 1..=n {
        for j in 1..=m {
            table[i][j] = if old[i - 1] == new[j - 1] {
                table[i - 1][j - 1] + 1
            } else {
                table[i - 1][j].max(table[i][j - 1])
            };
        }
    }
    let (mut i, mut j) = (n, m);
    let mut ops = Vec::new();
    while i > 0 && j > 0 {
        if old[i - 1] == new[j - 1] {
            ops.push(DiffOp::Match);
            i -= 1;
            j -= 1;
        } else if table[i - 1][j] >= table[i][j - 1] {
            ops.push(DiffOp::Delete);
            i -= 1;
        } else {
            ops.push(DiffOp::Insert);
            j -= 1;
        }
    }
    for _ in 0..i {
        ops.push(DiffOp::Delete);
    }
    for _ in 0..j {
        ops.push(DiffOp::Insert);
    }
    ops.reverse();
    ops
}

/// Only words inserted where something was also removed count as a learned correction
/// (a misheard word replaced by the right one). Words merely added or removed, with nothing
/// on the other side, are ordinary edits and are not vocabulary corrections.
fn flush_hunk(
    had_removal: bool,
    additions: &mut Vec<String>,
    old: &[String],
    learned: &mut Vec<String>,
) {
    if had_removal {
        for word in additions.drain(..) {
            if word.len() > 1 && !old.contains(&word) && !learned.contains(&word) {
                learned.push(word);
            }
        }
    } else {
        additions.clear();
    }
}

fn correction_terms(original: &str, corrected: &str) -> Vec<String> {
    let old: Vec<String> = original.split_whitespace().map(normalize_word).collect();
    let new: Vec<String> = corrected.split_whitespace().map(normalize_word).collect();
    let ops = diff_ops(&old, &new);

    let mut learned = Vec::new();
    let mut new_index = 0usize;
    let mut had_removal = false;
    let mut additions: Vec<String> = Vec::new();
    for op in &ops {
        match op {
            DiffOp::Match => {
                flush_hunk(had_removal, &mut additions, &old, &mut learned);
                had_removal = false;
                new_index += 1;
            }
            DiffOp::Delete => had_removal = true,
            DiffOp::Insert => {
                additions.push(new[new_index].clone());
                new_index += 1;
            }
        }
    }
    flush_hunk(had_removal, &mut additions, &old, &mut learned);
    learned
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

    #[test]
    fn inserting_a_word_does_not_learn_it_as_a_correction() {
        // Adding "really" shifts every later word by one position; a naive index-based
        // comparison would misread that shift as a vocabulary correction.
        assert_eq!(
            correction_terms("I love Victor", "I really love Viktor"),
            vec!["Viktor"]
        );
    }

    #[test]
    fn removing_a_word_learns_nothing() {
        assert_eq!(
            correction_terms("Hello there friend", "Hello friend"),
            Vec::<String>::new()
        );
    }

    #[test]
    fn combines_every_long_recording_part_in_order() {
        let parts = vec![
            "first twenty-five seconds".to_string(),
            " second twenty-five seconds ".to_string(),
            "final twenty-five seconds".to_string(),
        ];
        assert_eq!(
            combine_transcript_parts(&parts),
            "first twenty-five seconds second twenty-five seconds final twenty-five seconds"
        );
    }
}
