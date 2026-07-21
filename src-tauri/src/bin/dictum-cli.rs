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
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let store = Store::new()?;
    match cli.command {
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
            let provider_id = provider.unwrap_or(settings.provider);
            let manifest = store.provider(&provider_id)?;
            let key = std::env::var(if provider_id == "mistral" {
                "MISTRAL_API_KEY"
            } else {
                "OPENROUTER_API_KEY"
            })
            .ok()
            .or(keychain::get(&provider_id)?);
            let local_endpoint = endpoint.as_deref().unwrap_or(&settings.local_endpoint);
            let service = create_provider(manifest, key, Some(local_endpoint));
            let options = TranscribeOpts {
                model: model.unwrap_or(settings.model),
                language: language
                    .or_else(|| (settings.language != "auto").then_some(settings.language)),
                biasing: store.dictionary()?.into_iter().map(|d| d.term).collect(),
                zero_retention: settings.zero_retention,
            };
            let result = service
                .transcribe(
                    &AudioChunk {
                        wav: bytes,
                        duration_ms,
                    },
                    &options,
                )
                .await?;
            println!("{}", result.text);
        }
    }
    Ok(())
}
