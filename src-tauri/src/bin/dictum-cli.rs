use std::path::PathBuf;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use dictum_lib::{
    audio::AudioChunk,
    keychain,
    store::Store,
    transcribe::{create_provider, TranscribeOpts},
};

#[derive(Parser)]
#[command(
    name = "dictum",
    version,
    about = "Scriptable voice transcription using your Dictum configuration"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Transcribe a WAV file and print only its text.
    Transcribe {
        file: PathBuf,
        #[arg(long)]
        provider: Option<String>,
        #[arg(long)]
        model: Option<String>,
        #[arg(long)]
        language: Option<String>,
        /// Override the provider base URL (especially useful for local vLLM).
        #[arg(long)]
        endpoint: Option<String>,
    },
    /// Print the local SQLite path (never contains API keys).
    ConfigPath,
    /// Manage models downloaded for on-device dictation.
    Models {
        #[command(subcommand)]
        action: ModelAction,
    },
}

#[derive(Subcommand)]
enum ModelAction {
    List,
    Download { id: String },
    Remove { id: String },
    Import { id: String, file: PathBuf },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let store = Store::new()?;
    match cli.command {
        Command::Models { action } => {
            let manager = dictum_lib::transcribe::native::ModelManager::new(store.model_dir());
            match action {
                ModelAction::List => {
                    for status in manager.list() {
                        println!(
                            "{}\t{}\t{}",
                            status.model.id,
                            if status.installed {
                                "installed"
                            } else {
                                "available"
                            },
                            status.model.size
                        );
                    }
                }
                ModelAction::Download { id } => {
                    manager
                        .download(&id, |p| {
                            eprintln!("{} {} / {}", p.phase, p.downloaded, p.total)
                        })
                        .await?
                }
                ModelAction::Remove { id } => manager.delete(&id)?,
                ModelAction::Import { id, file } => {
                    manager
                        .import(&id, file, |p| {
                            eprintln!("{} {} / {}", p.phase, p.downloaded, p.total)
                        })
                        .await?
                }
            }
        }
        Command::ConfigPath => println!("{}", store.path().display()),
        Command::Transcribe {
            file,
            provider,
            model,
            language,
            endpoint,
        } => {
            let bytes = tokio::fs::read(&file)
                .await
                .with_context(|| format!("could not read {}", file.display()))?;
            anyhow::ensure!(
                bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WAVE"),
                "v1 CLI accepts PCM WAV input"
            );
            let reader = hound::WavReader::new(std::io::Cursor::new(&bytes))?;
            let duration_ms = reader.duration() as u64 * 1000 / reader.spec().sample_rate as u64;
            let settings = store.settings()?;
            let provider_id = provider.unwrap_or(settings.provider.clone());
            let mut manifest = store.provider(&provider_id)?.effective(&settings);
            if let Some(endpoint) = &endpoint {
                manifest.base_url = endpoint.clone();
            }
            let env_name = format!("{}_API_KEY", provider_id.to_ascii_uppercase());
            let key = std::env::var(&env_name)
                .ok()
                .or(keychain::get(&provider_id)?);
            let service = create_provider(manifest, key, None, store.model_dir());
            let options = TranscribeOpts {
                model: model.unwrap_or_else(|| {
                    if provider_id == settings.provider {
                        settings.model.clone()
                    } else {
                        settings
                            .provider_models
                            .get(&provider_id)
                            .cloned()
                            .unwrap_or_else(|| {
                                store
                                    .provider(&provider_id)
                                    .ok()
                                    .and_then(|p| p.models.into_iter().next())
                                    .unwrap_or_default()
                            })
                    }
                }),
                language: language
                    .or_else(|| (settings.language != "auto").then_some(settings.language)),
                biasing: store.dictionary()?.into_iter().map(|d| d.term).collect(),
                zero_retention: settings.zero_retention,
                cancellation: tokio_util::sync::CancellationToken::new(),
            };
            let live_local = provider_id == "offline"
                && dictum_lib::transcribe::native::model(&options.model).is_ok_and(|m| m.live);
            let result = if live_local {
                transcribe_local_live(&bytes, &options, &store.model_dir()).await?
            } else {
                service
                    .transcribe(
                        &AudioChunk {
                            wav: bytes,
                            duration_ms,
                        },
                        &options,
                    )
                    .await?
            };
            println!("{}", result.text);
        }
    }
    Ok(())
}

async fn transcribe_local_live(
    bytes: &[u8],
    options: &TranscribeOpts,
    root: &std::path::Path,
) -> Result<dictum_lib::transcribe::Transcript> {
    use dictum_lib::transcribe::{
        native::decode_wav,
        realtime::{RealtimeDialect, RealtimeEvent, RealtimeSession},
        Transcript,
    };
    let samples: Vec<i16> = decode_wav(bytes)?
        .into_iter()
        .map(|s| (s * 32768.0) as i16)
        .collect();
    let mut session = RealtimeSession::connect_extended(
        "",
        &options.model,
        None,
        RealtimeDialect::Native,
        options,
        root,
    )
    .await?;
    let tx = session.sender();
    let sender = tokio::spawn(async move {
        for chunk in samples.chunks(1600) {
            if tx.send(chunk.to_vec()).await.is_err() {
                return;
            }
        }
        let _ = tx.send(Vec::new()).await;
    });
    let result = tokio::time::timeout(std::time::Duration::from_secs(180), async {
        while let Some(event) = session.events.recv().await {
            match event {
                RealtimeEvent::Final(text) => {
                    anyhow::ensure!(!text.trim().is_empty(), "No speech was recognized.");
                    return Ok(Transcript {
                        text,
                        language: options.language.clone(),
                        cost_usd: Some(0.0),
                        segments: Vec::new(),
                    });
                }
                RealtimeEvent::Error(error) => anyhow::bail!(error),
                _ => {}
            }
        }
        anyhow::bail!("Local streaming ended without a transcript")
    })
    .await;
    sender.abort();
    result.context("Local streaming took too long")?
}
