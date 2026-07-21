mod generic;
pub mod realtime;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::audio::AudioChunk;
use crate::store::ProviderManifest;

pub use generic::HttpTranscriptionProvider;

#[derive(Debug, Clone)]
pub struct TranscribeOpts {
    pub model: String,
    pub language: Option<String>,
    pub biasing: Vec<String>,
    pub zero_retention: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Transcript {
    pub text: String,
    pub cost_usd: Option<f64>,
    pub language: Option<String>,
}

#[derive(Debug, Error)]
pub enum TranscribeError {
    #[error("API key rejected")]
    InvalidKey,
    #[error("provider quota exhausted")]
    Quota,
    #[error("provider rate limit reached; try again shortly")]
    RateLimited,
    #[error("network request failed: {0}")]
    Network(String),
    #[error("provider is temporarily unavailable: {0}")]
    Unavailable(String),
    #[error("provider returned an invalid response: {0}")]
    InvalidResponse(String),
    #[error("transcription was cancelled")]
    Cancelled,
}

impl TranscribeError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidKey => "invalid_key",
            Self::Quota => "quota",
            Self::RateLimited => "rate_limited",
            Self::Network(_) => "network",
            Self::Unavailable(_) => "provider_error",
            Self::InvalidResponse(_) => "provider_error",
            Self::Cancelled => "cancelled",
        }
    }
}

#[async_trait]
pub trait TranscriptionProvider: Send + Sync {
    async fn transcribe(
        &self,
        audio: &AudioChunk,
        opts: &TranscribeOpts,
    ) -> Result<Transcript, TranscribeError>;
    fn id(&self) -> &str;
    fn supports_realtime(&self) -> bool;
}

pub fn create_provider(
    manifest: ProviderManifest,
    api_key: Option<String>,
    local_endpoint: Option<&str>,
) -> Box<dyn TranscriptionProvider> {
    let mut manifest = manifest;
    if manifest.id == "local" {
        if let Some(endpoint) = local_endpoint {
            manifest.base_url = endpoint.trim_end_matches('/').to_string();
        }
    }
    Box::new(HttpTranscriptionProvider::new(manifest, api_key))
}
