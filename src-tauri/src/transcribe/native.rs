//! Managed, in-process local inference. No terminal, service, or audio files are needed.
use super::{TranscribeError, TranscribeOpts, Transcript, TranscriptionProvider};
use crate::audio::AudioChunk;
use anyhow::{bail, Context, Result};
use async_trait::async_trait;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    io::{Cursor, Read, Write},
    path::{Component, Path, PathBuf},
    sync::{mpsc, Mutex, OnceLock},
};
use tokio_util::sync::CancellationToken;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModel {
    pub id: String,
    pub name: String,
    pub engine: String,
    pub url: String,
    pub sha256: String,
    pub size: u64,
    pub ram_gb: u32,
    pub license: String,
    pub languages: Vec<String>,
    pub live: bool,
    pub files: HashMap<String, String>,
    pub archive: bool,
}
pub fn catalogue() -> Vec<LocalModel> {
    serde_json::from_str(include_str!("../../catalog/local-models.json"))
        .expect("local model catalogue")
}
pub fn model(id: &str) -> Result<LocalModel> {
    catalogue()
        .into_iter()
        .find(|m| m.id == id)
        .context("Choose a model from the local catalogue.")
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
    pub model: LocalModel,
    pub installed: bool,
    pub downloaded: u64,
    pub downloading: bool,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub id: String,
    pub downloaded: u64,
    pub total: u64,
    pub phase: String,
}

pub struct ModelManager {
    pub root: PathBuf,
    downloads: Mutex<HashMap<String, CancellationToken>>,
}
impl ModelManager {
    pub fn new(root: PathBuf) -> Self {
        Self {
            root,
            downloads: Mutex::new(HashMap::new()),
        }
    }
    pub fn list(&self) -> Vec<ModelStatus> {
        let downloads = self.downloads.lock().expect("downloads");
        catalogue()
            .into_iter()
            .map(|m| ModelStatus {
                installed: self.root.join(&m.id).join("ready.json").is_file(),
                downloaded: std::fs::metadata(self.root.join(format!("{}.part", m.id)))
                    .map_or(0, |m| m.len()),
                downloading: downloads.contains_key(&m.id),
                model: m,
            })
            .collect()
    }
    pub fn pause(&self, id: &str) {
        if let Some(token) = self.downloads.lock().expect("downloads").get(id) {
            token.cancel();
        }
    }
    pub async fn download(
        &self,
        id: &str,
        progress: impl Fn(DownloadProgress) + Send + Sync,
    ) -> Result<()> {
        let m = model(id)?;
        std::fs::create_dir_all(&self.root)?;
        let token = CancellationToken::new();
        {
            let mut downloads = self.downloads.lock().expect("downloads");
            if downloads.contains_key(id) {
                bail!("This download is already running.");
            }
            downloads.insert(id.into(), token.clone());
        }
        let result = self.download_inner(&m, &token, &progress).await;
        self.downloads.lock().expect("downloads").remove(id);
        result
    }
    pub async fn import(
        &self,
        id: &str,
        source: PathBuf,
        progress: impl Fn(DownloadProgress) + Send + Sync,
    ) -> Result<()> {
        let m = model(id)?;
        anyhow::ensure!(
            std::fs::metadata(&source)?.len() == m.size,
            "This file does not match the selected model package. Use the original catalogue file."
        );
        std::fs::create_dir_all(&self.root)?;
        let token = CancellationToken::new();
        {
            let mut downloads = self.downloads.lock().expect("downloads");
            anyhow::ensure!(
                !downloads.contains_key(id),
                "This model is already being installed."
            );
            downloads.insert(id.into(), token.clone());
        }
        let result = async {
            anyhow::ensure!(
                fs2::available_space(&self.root)?
                    > m.size * (if m.archive { 4 } else { 3 }) + 64 * 1024 * 1024,
                "Not enough free disk space to import this model."
            );
            let partial = self.root.join(format!("{}.part", m.id));
            anyhow::ensure!(
                source.canonicalize()?
                    != partial.canonicalize().unwrap_or_else(|_| partial.clone()),
                "Select the original model file, not Dictum's download temporary file."
            );
            tokio::fs::copy(source, partial).await?;
            self.download_inner(&m, &token, &progress).await
        }
        .await;
        self.downloads.lock().expect("downloads").remove(id);
        result
    }
    async fn download_inner(
        &self,
        m: &LocalModel,
        token: &CancellationToken,
        progress: &(impl Fn(DownloadProgress) + Send + Sync),
    ) -> Result<()> {
        let partial = self.root.join(format!("{}.part", m.id));
        let mut downloaded = std::fs::metadata(&partial).map_or(0, |m| m.len());
        if downloaded > m.size {
            std::fs::remove_file(&partial)?;
            downloaded = 0;
        }
        let required = m.size.saturating_sub(downloaded)
            + m.size * (if m.archive { 3 } else { 2 })
            + 64 * 1024 * 1024;
        anyhow::ensure!(
            fs2::available_space(&self.root)? > required,
            "Not enough free disk space. Choose a smaller model or free some space."
        );
        let report = |downloaded, phase: &str| {
            progress(DownloadProgress {
                id: m.id.clone(),
                downloaded,
                total: m.size,
                phase: phase.into(),
            })
        };
        if downloaded < m.size {
            let client = reqwest::Client::builder()
                .connect_timeout(std::time::Duration::from_secs(15))
                .build()?;
            let mut request = client.get(&m.url);
            if downloaded > 0 {
                request = request.header("Range", format!("bytes={downloaded}-"));
            }
            let response = tokio::select! {_=token.cancelled()=>{report(downloaded,"paused");return Ok(());},r=request.send()=>r?};
            anyhow::ensure!(
                response.status().is_success(),
                "The model download service is unavailable. Retry later."
            );
            if response.status() == reqwest::StatusCode::PARTIAL_CONTENT {
                let range = response
                    .headers()
                    .get("content-range")
                    .and_then(|h| h.to_str().ok())
                    .unwrap_or("");
                anyhow::ensure!(
                    range.starts_with(&format!("bytes {downloaded}-")),
                    "The server could not resume this download."
                );
            } else {
                downloaded = 0;
            }
            let mut file = std::fs::OpenOptions::new()
                .create(true)
                .write(true)
                .truncate(downloaded == 0)
                .append(downloaded > 0)
                .open(&partial)?;
            let mut stream = response.bytes_stream();
            let mut last = std::time::Instant::now();
            loop {
                let chunk = tokio::select! {_=token.cancelled()=>{file.flush()?;report(downloaded,"paused");return Ok(());},chunk=stream.next()=>chunk};
                let Some(chunk) = chunk else {
                    break;
                };
                let chunk = chunk?;
                anyhow::ensure!(
                    downloaded + chunk.len() as u64 <= m.size,
                    "Unexpected model size. Download stopped."
                );
                file.write_all(&chunk)?;
                downloaded += chunk.len() as u64;
                if last.elapsed().as_millis() > 100 {
                    report(downloaded, "downloading");
                    last = std::time::Instant::now();
                }
            }
            file.flush()?;
        }
        anyhow::ensure!(
            downloaded == m.size,
            "The download was interrupted. Resume it to continue."
        );
        report(downloaded, "verifying");
        let p = partial.clone();
        let expected = m.sha256.clone();
        let verify_token = token.clone();
        let valid = tokio::task::spawn_blocking(move || verify_hash(&p, &expected, &verify_token))
            .await??;
        if token.is_cancelled() {
            report(downloaded, "paused");
            return Ok(());
        }
        if !valid {
            std::fs::remove_file(&partial)?;
            bail!("The downloaded model failed verification. Please download it again.");
        }
        let staging = self.root.join(format!("{}.extract", m.id));
        remove_owned_dir(&self.root, &staging)?;
        std::fs::create_dir_all(&staging)?;
        if m.archive {
            report(downloaded, "installing");
            let path = partial.clone();
            let target = staging.clone();
            let install_token = token.clone();
            let result =
                tokio::task::spawn_blocking(move || extract_archive(&path, &target, install_token))
                    .await?;
            if token.is_cancelled() {
                report(downloaded, "paused");
                return Ok(());
            }
            result?;
        } else {
            std::fs::copy(&partial, staging.join(&m.files["model"]))?;
        }
        if token.is_cancelled() {
            report(downloaded, "paused");
            return Ok(());
        }
        for file in m.files.values() {
            anyhow::ensure!(
                staging.join(file).exists(),
                "The model package is incomplete. Please download it again."
            );
        }
        std::fs::write(staging.join("ready.json"), serde_json::to_vec(m)?)?;
        let destination = self.root.join(&m.id);
        remove_owned_dir(&self.root, &destination)?;
        // Antivirus/indexing can briefly keep freshly extracted model files open
        // on Windows. Retry activation without re-downloading a verified package.
        let mut attempt = 0;
        loop {
            match activate_directory(&staging, &destination) {
                Ok(()) => break,
                Err(error)
                    if error.kind() == std::io::ErrorKind::PermissionDenied && attempt < 20 =>
                {
                    attempt += 1;
                    tokio::time::sleep(std::time::Duration::from_millis(250)).await;
                }
                Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {
                    // Some Windows folders keep a directory handle open longer
                    // than individual files. Activate by copying only verified
                    // data, writing the ready marker last. A failed copy never
                    // advertises an incomplete model as installed.
                    let from = staging.clone();
                    let to = destination.clone();
                    tokio::task::spawn_blocking(move || copy_verified_installation(&from, &to))
                        .await??;
                    let _ = remove_owned_dir(&self.root, &staging);
                    break;
                }
                Err(error) => return Err(error).context("Could not activate the local model"),
            }
        }
        std::fs::remove_file(partial)?;
        report(downloaded, "installed");
        Ok(())
    }
    pub fn delete(&self, id: &str) -> Result<()> {
        model(id)?;
        anyhow::ensure!(
            !self.downloads.lock().expect("downloads").contains_key(id),
            "Pause this download before removing the model."
        );
        remove_owned_dir(&self.root, &self.root.join(id))?;
        remove_owned_dir(&self.root, &self.root.join(format!("{id}.extract")))?;
        let p = self.root.join(format!("{id}.part"));
        if p.is_file() {
            std::fs::remove_file(p)?;
        }
        Ok(())
    }
}
fn copy_verified_installation(source: &Path, destination: &Path) -> Result<()> {
    fn copy_data(source: &Path, destination: &Path) -> Result<()> {
        std::fs::create_dir_all(destination)?;
        for entry in std::fs::read_dir(source)? {
            let entry = entry?;
            if entry.file_name() == "ready.json" {
                continue;
            }
            let kind = entry.file_type()?;
            anyhow::ensure!(
                !kind.is_symlink(),
                "Links are not allowed in model packages."
            );
            let target = destination.join(entry.file_name());
            if kind.is_dir() {
                copy_data(&entry.path(), &target)?;
            } else {
                std::fs::copy(entry.path(), target)?;
            }
        }
        Ok(())
    }
    copy_data(source, destination)?;
    std::fs::copy(source.join("ready.json"), destination.join("ready.json"))?;
    Ok(())
}
// MoveFileW works on supported Windows 10 file systems where Rust's newer
// handle-based directory rename can return ERROR_ACCESS_DENIED.
fn activate_directory(source: &Path, destination: &Path) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows::{core::PCWSTR, Win32::Storage::FileSystem::MoveFileW};
        let from: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
        let to: Vec<u16> = destination
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect();
        unsafe { MoveFileW(PCWSTR(from.as_ptr()), PCWSTR(to.as_ptr())) }
            .map_err(|_| std::io::Error::last_os_error())
    }
    #[cfg(not(windows))]
    {
        std::fs::rename(source, destination)
    }
}
fn remove_owned_dir(root: &Path, path: &Path) -> Result<()> {
    if path.exists() {
        let root = root.canonicalize()?;
        let resolved = path.canonicalize()?;
        anyhow::ensure!(
            resolved.starts_with(&root)
                && resolved != root
                && !std::fs::symlink_metadata(path)?.file_type().is_symlink(),
            "Model path is outside the model directory."
        );
        std::fs::remove_dir_all(path)?;
    }
    Ok(())
}
fn verify_hash(path: &Path, expected: &str, token: &CancellationToken) -> Result<bool> {
    let mut reader = std::fs::File::open(path)?;
    let mut hash = Sha256::new();
    let mut buf = [0; 65536];
    loop {
        if token.is_cancelled() {
            return Ok(false);
        }
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hash.update(&buf[..n]);
    }
    Ok(format!("{:x}", hash.finalize()) == expected)
}
struct CancellableRead<R> {
    reader: R,
    token: CancellationToken,
}
impl<R: Read> Read for CancellableRead<R> {
    fn read(&mut self, bytes: &mut [u8]) -> std::io::Result<usize> {
        if self.token.is_cancelled() {
            return Err(std::io::Error::other("Model installation paused"));
        }
        self.reader.read(bytes)
    }
}
fn extract_archive(path: &Path, target: &Path, token: CancellationToken) -> Result<()> {
    let decoder = bzip2::read::BzDecoder::new(CancellableRead {
        reader: std::fs::File::open(path)?,
        token,
    });
    let mut archive = tar::Archive::new(decoder);
    let mut total = 0u64;
    for entry in archive.entries()? {
        let mut entry = entry?;
        let path = entry.path()?.into_owned();
        let mut components = path.components();
        components.next();
        let relative: PathBuf = components.collect();
        anyhow::ensure!(
            relative
                .components()
                .all(|c| matches!(c, Component::Normal(_))),
            "Unsafe model archive path."
        );
        if relative.as_os_str().is_empty() {
            continue;
        }
        let kind = entry.header().entry_type();
        anyhow::ensure!(
            kind.is_file() || kind.is_dir(),
            "Links are not allowed in model packages."
        );
        let destination = target.join(relative);
        if kind.is_dir() {
            std::fs::create_dir_all(destination)?;
            continue;
        }
        let extension = destination
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        anyhow::ensure!(
            !matches!(
                extension.to_ascii_lowercase().as_str(),
                "exe" | "dll" | "bat" | "cmd" | "ps1" | "py" | "sh"
            ),
            "Executable files are not allowed in model packages."
        );
        total += entry.size();
        anyhow::ensure!(
            total < 16 * 1024 * 1024 * 1024,
            "Model archive exceeds its installation size limit."
        );
        if let Some(parent) = destination.parent() {
            std::fs::create_dir_all(parent)?;
        }
        entry.unpack(destination)?;
    }
    Ok(())
}

enum Engine {
    Whisper(WhisperContext),
    Offline(sherpa_onnx::OfflineRecognizer),
}
struct Work {
    model: LocalModel,
    root: PathBuf,
    audio: Vec<u8>,
    opts: TranscribeOpts,
    reply: tokio::sync::oneshot::Sender<Result<Transcript, String>>,
}
fn worker() -> &'static mpsc::Sender<Work> {
    static WORKER: OnceLock<mpsc::Sender<Work>> = OnceLock::new();
    WORKER.get_or_init(|| {
        let (tx, rx) = mpsc::channel::<Work>();
        std::thread::spawn(move || {
            let mut cached: Option<(PathBuf, String, Engine)> = None;
            while let Ok(work) = rx.recv() {
                if work.opts.cancellation.is_cancelled() {
                    continue;
                }
                let result = (|| {
                    if cached
                        .as_ref()
                        .is_none_or(|(root, id, _)| root != &work.root || id != &work.model.id)
                    {
                        cached = None;
                        let engine = load_engine(&work.root, &work.model)?;
                        cached = Some((work.root.clone(), work.model.id.clone(), engine));
                    }
                    let engine = &mut cached.as_mut().expect("loaded model").2;
                    if work.audio.is_empty() {
                        Ok(Transcript::default())
                    } else {
                        infer(engine, &work.audio, &work.opts)
                    }
                })();
                let _ = work
                    .reply
                    .send(result.map_err(|e: anyhow::Error| e.to_string()));
            }
        });
        tx
    })
}

fn file(root: &Path, m: &LocalModel, key: &str) -> Result<String> {
    let name = m.files.get(key).context("Missing model file definition")?;
    let path = root.join(&m.id).join(name);
    anyhow::ensure!(path.exists(), "Download this model before using it.");
    Ok(path.to_string_lossy().into_owned())
}
fn load_engine(root: &Path, m: &LocalModel) -> Result<Engine> {
    whisper_rs::install_logging_hooks();
    anyhow::ensure!(
        root.join(&m.id).join("ready.json").is_file(),
        "Download this model in Transcription → On this computer first."
    );
    if m.engine == "whisper" {
        let mut params = WhisperContextParameters::default();
        params.use_gpu(cfg!(any(feature = "cuda", feature = "vulkan")));
        return Ok(Engine::Whisper(
            WhisperContext::new_with_params(&file(root, m, "model")?, params)
                .context("Could not load the model. Try a lighter model.")?,
        ));
    }
    let mut cfg = sherpa_onnx::OfflineRecognizerConfig::default();
    cfg.model_config.num_threads = threads();
    cfg.model_config.provider = Some("cpu".into());
    cfg.decoding_method = Some("greedy_search".into());
    match m.engine.as_str() {
        "parakeet" => {
            cfg.model_config.transducer.encoder = Some(file(root, m, "encoder")?);
            cfg.model_config.transducer.decoder = Some(file(root, m, "decoder")?);
            cfg.model_config.transducer.joiner = Some(file(root, m, "joiner")?);
            cfg.model_config.tokens = Some(file(root, m, "tokens")?);
            cfg.model_config.model_type = Some("nemo_transducer".into());
        }
        "qwen" => {
            cfg.model_config.qwen3_asr.encoder = Some(file(root, m, "encoder")?);
            cfg.model_config.qwen3_asr.decoder = Some(file(root, m, "decoder")?);
            cfg.model_config.qwen3_asr.conv_frontend = Some(file(root, m, "frontend")?);
            cfg.model_config.qwen3_asr.tokenizer = Some(file(root, m, "tokenizer")?);
            cfg.model_config.qwen3_asr.max_new_tokens = 512;
        }
        "moonshine" => {
            cfg.model_config.moonshine.preprocessor = Some(file(root, m, "preprocessor")?);
            cfg.model_config.moonshine.encoder = Some(file(root, m, "encoder")?);
            cfg.model_config.moonshine.uncached_decoder = Some(file(root, m, "uncached_decoder")?);
            cfg.model_config.moonshine.cached_decoder = Some(file(root, m, "cached_decoder")?);
            cfg.model_config.tokens = Some(file(root, m, "tokens")?);
        }
        _ => bail!("This model uses a streaming engine. Select it in Live mode."),
    }
    Ok(Engine::Offline(
        sherpa_onnx::OfflineRecognizer::create(&cfg).context(
            "Could not load this model. Check available memory or choose a lighter model.",
        )?,
    ))
}
fn threads() -> i32 {
    if let Ok(value) = std::env::var("DICTUM_CPU_THREADS") {
        if let Ok(n) = value.parse::<i32>() {
            return n.clamp(1, 8);
        }
    }
    std::thread::available_parallelism().map_or(2, |n| n.get().clamp(1, 8) as i32)
}
pub fn decode_wav(bytes: &[u8]) -> Result<Vec<f32>> {
    let mut reader = hound::WavReader::new(Cursor::new(bytes))?;
    let spec = reader.spec();
    anyhow::ensure!(
        spec.sample_rate == 16000 && spec.channels == 1 && spec.bits_per_sample == 16,
        "Local dictation needs 16 kHz mono PCM WAV audio."
    );
    reader
        .samples::<i16>()
        .map(|s| s.map(|v| v as f32 / 32768.0).map_err(Into::into))
        .collect()
}
fn infer(engine: &mut Engine, audio: &[u8], opts: &TranscribeOpts) -> Result<Transcript> {
    let samples = decode_wav(audio)?;
    let text = match engine {
        Engine::Whisper(context) => {
            let mut state = context.create_state()?;
            let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
            params.set_n_threads(threads());
            params.set_language(opts.language.as_deref());
            params.set_translate(false);
            params.set_print_progress(false);
            params.set_print_realtime(false);
            params.set_print_special(false);
            params.set_print_timestamps(false);
            if !opts.biasing.is_empty() {
                params.set_initial_prompt(&opts.biasing.join(", "));
            }
            let token = opts.cancellation.clone();
            // whisper-rs 0.16's closure helper stores a boxed trait object but casts
            // it back to F in the C trampoline. Use a correctly typed pointer.
            // `token` outlives the synchronous full() call, including its workers.
            unsafe extern "C" fn cancelled(data: *mut std::ffi::c_void) -> bool {
                unsafe { (&*(data as *const CancellationToken)).is_cancelled() }
            }
            unsafe {
                params.set_abort_callback(Some(cancelled));
                params.set_abort_callback_user_data(
                    (&token as *const CancellationToken).cast_mut().cast(),
                );
            }
            state.full(params, &samples)?;
            state
                .as_iter()
                .map(|s| s.to_str().map(str::to_owned))
                .collect::<std::result::Result<Vec<_>, _>>()?
                .join("")
                .trim()
                .to_owned()
        }
        Engine::Offline(recognizer) => {
            let stream = recognizer.create_stream();
            if let Some(language) = &opts.language {
                stream.set_option("language", language);
            }
            stream.accept_waveform(16000, &samples);
            recognizer.decode(&stream);
            stream
                .get_result()
                .context("No result from local model")?
                .text
        }
    };
    anyhow::ensure!(!opts.cancellation.is_cancelled(), "Dictation cancelled.");
    anyhow::ensure!(
        !text.is_empty(),
        "No speech was recognized. Try speaking closer to the microphone."
    );
    Ok(Transcript {
        text,
        language: opts.language.clone(),
        cost_usd: Some(0.0),
        segments: Vec::new(),
    })
}
pub struct NativeProvider {
    root: PathBuf,
}
impl NativeProvider {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }
}
#[async_trait]
impl TranscriptionProvider for NativeProvider {
    async fn transcribe(
        &self,
        audio: &AudioChunk,
        opts: &TranscribeOpts,
    ) -> Result<Transcript, TranscribeError> {
        if opts.cancellation.is_cancelled() {
            return Err(TranscribeError::Cancelled);
        }
        let m = model(&opts.model).map_err(|e| TranscribeError::InvalidResponse(e.to_string()))?;
        let (tx, rx) = tokio::sync::oneshot::channel();
        worker()
            .send(Work {
                model: m,
                root: self.root.clone(),
                audio: audio.wav.clone(),
                opts: opts.clone(),
                reply: tx,
            })
            .map_err(|_| {
                TranscribeError::Unavailable("Local inference worker is unavailable.".into())
            })?;
        tokio::select! {
            _ = opts.cancellation.cancelled() => Err(TranscribeError::Cancelled),
            r = rx => {
                if opts.cancellation.is_cancelled() { return Err(TranscribeError::Cancelled); }
                r.map_err(|_| TranscribeError::Unavailable("Local inference stopped.".into()))?.map_err(TranscribeError::InvalidResponse)
            }
        }
    }
    fn id(&self) -> &str {
        "offline"
    }
    fn supports_realtime(&self) -> bool {
        true
    }
}
pub async fn prepare(root: PathBuf, id: String) -> Result<()> {
    let m = model(&id)?;
    if m.live {
        return tokio::task::spawn_blocking(move || with_online(&root, &m, |_| Ok(()))).await?;
    }
    let (tx, rx) = tokio::sync::oneshot::channel();
    worker().send(Work {
        model: m,
        root,
        audio: Vec::new(),
        opts: TranscribeOpts {
            model: id,
            language: None,
            biasing: Vec::new(),
            zero_retention: true,
            cancellation: CancellationToken::new(),
        },
        reply: tx,
    })?;
    rx.await?.map(|_| ()).map_err(anyhow::Error::msg)
}

struct OnlineCache {
    root: PathBuf,
    id: String,
    recognizer: sherpa_onnx::OnlineRecognizer,
}
pub fn with_online<R>(
    root: &Path,
    m: &LocalModel,
    run: impl FnOnce(&sherpa_onnx::OnlineRecognizer) -> Result<R>,
) -> Result<R> {
    static CACHE: OnceLock<Mutex<Option<OnlineCache>>> = OnceLock::new();
    let mut cache = CACHE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map_err(|_| anyhow::anyhow!("Local streaming worker is unavailable"))?;
    if cache
        .as_ref()
        .is_none_or(|c| c.root != root || c.id != m.id)
    {
        *cache = None;
        *cache = Some(OnlineCache {
            root: root.to_owned(),
            id: m.id.clone(),
            recognizer: online_engine(root, m)?,
        });
    }
    run(&cache.as_ref().expect("loaded streaming model").recognizer)
}
fn online_engine(root: &Path, m: &LocalModel) -> Result<sherpa_onnx::OnlineRecognizer> {
    anyhow::ensure!(
        root.join(&m.id).join("ready.json").is_file(),
        "Download the live model first."
    );
    let mut config = sherpa_onnx::OnlineRecognizerConfig::default();
    config.model_config.transducer.encoder = Some(file(root, m, "encoder")?);
    config.model_config.transducer.decoder = Some(file(root, m, "decoder")?);
    config.model_config.transducer.joiner = Some(file(root, m, "joiner")?);
    config.model_config.tokens = Some(file(root, m, "tokens")?);
    config.model_config.model_type = Some("nemo_transducer".into());
    config.enable_endpoint = true;
    config.rule1_min_trailing_silence = 2.4;
    config.rule2_min_trailing_silence = 0.8;
    config.rule3_min_utterance_length = 20.0;
    config.model_config.num_threads = threads();
    config.decoding_method = Some("greedy_search".into());
    sherpa_onnx::OnlineRecognizer::create(&config)
        .context("Could not load the live model. Check available memory.")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn catalogue_has_pinned_hashes_and_safe_paths() {
        for m in catalogue() {
            assert_eq!(m.sha256.len(), 64);
            assert!(m.sha256.chars().all(|c| c.is_ascii_hexdigit()));
            assert!(m
                .id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.'));
            assert!(m.url.starts_with("https://"));
        }
    }
    #[test]
    fn verification_rejects_corruption() {
        let root = std::env::temp_dir().join(format!("dictum-hash-{}", uuid::Uuid::new_v4()));
        std::fs::write(&root, b"bad").unwrap();
        assert!(!verify_hash(&root, &"0".repeat(64), &CancellationToken::new()).unwrap());
        std::fs::remove_file(root).unwrap();
    }
    #[test]
    fn pausing_stops_archive_reads() {
        let token = CancellationToken::new();
        let mut reader = CancellableRead {
            reader: Cursor::new(b"model weights"),
            token: token.clone(),
        };
        assert_eq!(reader.read(&mut [0; 4]).unwrap(), 4);
        token.cancel();
        assert!(reader.read(&mut [0; 4]).is_err());
    }
    #[test]
    fn extracted_directory_activates_and_stays_inside_model_root() {
        let root = std::env::temp_dir().join(format!("dictum-model-{}", uuid::Uuid::new_v4()));
        let staging = root.join("model.extract");
        std::fs::create_dir_all(staging.join("tokenizer")).unwrap();
        std::fs::write(staging.join("tokenizer/tokens.json"), b"{}").unwrap();
        activate_directory(&staging, &root.join("model")).unwrap();
        assert!(root.join("model/tokenizer/tokens.json").is_file());
        assert!(remove_owned_dir(&root, &root).is_err());
        remove_owned_dir(&root, &root.join("model")).unwrap();
        std::fs::remove_dir(root).unwrap();
    }
    #[tokio::test]
    async fn interrupted_download_resumes_and_verifies_before_activation() {
        use std::io::{Read, Write};
        let root = std::env::temp_dir().join(format!("dictum-resume-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("fixture.part"), b"hel").unwrap();
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(std::time::Duration::from_secs(3)))
                .unwrap();
            let mut bytes = [0; 4096];
            let n = socket.read(&mut bytes).unwrap();
            let request = String::from_utf8_lossy(&bytes[..n]).to_ascii_lowercase();
            assert!(request.contains("range: bytes=3-"));
            socket.write_all(b"HTTP/1.1 206 Partial Content\r\nContent-Length: 2\r\nContent-Range: bytes 3-4/5\r\nConnection: close\r\n\r\nlo").unwrap();
        });
        let model = LocalModel {
            id: "fixture".into(),
            name: "Fixture".into(),
            engine: "whisper".into(),
            url: format!("http://{address}/weights"),
            sha256: format!("{:x}", Sha256::digest(b"hello")),
            size: 5,
            ram_gb: 1,
            license: "MIT".into(),
            languages: vec!["en".into()],
            live: false,
            files: HashMap::from([("model".into(), "model.bin".into())]),
            archive: false,
        };
        let manager = ModelManager::new(root.clone());
        manager
            .download_inner(&model, &CancellationToken::new(), &|_| {})
            .await
            .unwrap();
        server.join().unwrap();
        assert_eq!(
            std::fs::read(root.join("fixture/model.bin")).unwrap(),
            b"hello"
        );
        assert!(root.join("fixture/ready.json").is_file());
        assert!(!root.join("fixture.part").exists());
        std::fs::remove_dir_all(root).unwrap();
    }
}
