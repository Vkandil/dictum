use std::time::Duration;

use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::{multipart, Client, StatusCode};
use serde::Deserialize;
use serde_json::json;
use tokio::time::sleep;

use super::{TranscribeError, TranscribeOpts, Transcript, TranscriptionProvider};
use crate::audio::AudioChunk;
use crate::store::ProviderManifest;

const TRANSCRIPTION_TIMEOUT: Duration = Duration::from_secs(90);

pub struct HttpTranscriptionProvider {
    manifest: ProviderManifest,
    api_key: Option<String>,
    client: Client,
}

impl HttpTranscriptionProvider {
    pub fn new(manifest: ProviderManifest, api_key: Option<String>) -> Self {
        Self {
            manifest,
            api_key,
            client: Client::builder()
                .timeout(TRANSCRIPTION_TIMEOUT)
                .user_agent("Dictum/1.0 (https://github.com/dictum-app/dictum)")
                .build()
                .expect("HTTP client"),
        }
    }

    async fn request(
        &self,
        audio: &AudioChunk,
        opts: &TranscribeOpts,
    ) -> Result<Transcript, TranscribeError> {
        if self.manifest.id == "openrouter" {
            if opts.model.contains("voxtral-small") {
                return self.openrouter_quality(audio, opts).await;
            }
            self.openrouter_json(audio, opts).await
        } else {
            self.multipart(audio, opts).await
        }
    }

    async fn openrouter_json(
        &self,
        audio: &AudioChunk,
        opts: &TranscribeOpts,
    ) -> Result<Transcript, TranscribeError> {
        let body = openrouter_body(audio, opts);
        let mut request = self.client.post(self.url()).json(&body);
        request = self.authorize(request);
        parse_response(request.send().await.map_err(network)?).await
    }

    async fn openrouter_quality(
        &self,
        audio: &AudioChunk,
        opts: &TranscribeOpts,
    ) -> Result<Transcript, TranscribeError> {
        let prompt = if opts.biasing.is_empty() {
            "Transcribe faithfully. Add punctuation, remove hesitation, and return only the text."
                .to_string()
        } else {
            format!("Transcribe faithfully and return only the text. Preserve this vocabulary exactly: {}", opts.biasing.join(", "))
        };
        let mut body = json!({"model":opts.model,"messages":[{"role":"user","content":[{"type":"input_audio","input_audio":{"data":STANDARD.encode(&audio.wav),"format":"wav"}},{"type":"text","text":prompt}]}]});
        if opts.zero_retention {
            body["provider"] = json!({"zdr":true,"data_collection":"deny"});
        }
        let mut request = self
            .client
            .post(format!(
                "{}/chat/completions",
                self.manifest.base_url.trim_end_matches('/')
            ))
            .json(&body);
        request = self.authorize(request);
        let response = request.send().await.map_err(network)?;
        let status = response.status();
        let raw = response.text().await.map_err(network)?;
        map_status(status, &raw)?;
        let value: serde_json::Value = serde_json::from_str(&raw)
            .map_err(|_| TranscribeError::InvalidResponse(raw.clone()))?;
        let text = value
            .pointer("/choices/0/message/content")
            .and_then(|v| v.as_str())
            .ok_or(TranscribeError::InvalidResponse(raw))?;
        Ok(Transcript {
            text: text.trim().to_string(),
            cost_usd: value.pointer("/usage/cost").and_then(|v| v.as_f64()),
            language: None,
        })
    }

    async fn multipart(
        &self,
        audio: &AudioChunk,
        opts: &TranscribeOpts,
    ) -> Result<Transcript, TranscribeError> {
        let file = multipart::Part::bytes(audio.wav.clone())
            .file_name("dictum.wav")
            .mime_str("audio/wav")
            .map_err(|e| TranscribeError::InvalidResponse(e.to_string()))?;
        let mut form = multipart::Form::new()
            .part("file", file)
            .text("model", opts.model.clone());
        if let Some(language) = &opts.language {
            form = form.text("language", language.clone());
        }
        if !opts.biasing.is_empty() {
            let field = bias_field(&self.manifest.id);
            form = form.text(field, opts.biasing.join(","));
        }
        let request = self.authorize(self.client.post(self.url()).multipart(form));
        parse_response(request.send().await.map_err(network)?).await
    }

    fn authorize(&self, request: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        match &self.api_key {
            Some(key) if !key.is_empty() => request.bearer_auth(key),
            _ => request,
        }
    }
    fn url(&self) -> String {
        format!(
            "{}{}",
            self.manifest.base_url.trim_end_matches('/'),
            self.manifest.transcription_path.as_str()
        )
    }
}

#[async_trait]
impl TranscriptionProvider for HttpTranscriptionProvider {
    async fn transcribe(
        &self,
        audio: &AudioChunk,
        opts: &TranscribeOpts,
    ) -> Result<Transcript, TranscribeError> {
        let mut delay = 180;
        for attempt in 0..3 {
            match self.request(audio, opts).await {
                Err(error) if retryable(&error) && attempt < 2 => {
                    sleep(Duration::from_millis(delay)).await;
                    delay *= 2;
                }
                result => return result,
            }
        }
        unreachable!()
    }
    fn id(&self) -> &str {
        &self.manifest.id
    }
    fn supports_realtime(&self) -> bool {
        self.manifest.supports_realtime
    }
}

fn openrouter_body(audio: &AudioChunk, opts: &TranscribeOpts) -> serde_json::Value {
    let mut body = json!({"model":opts.model,"input_audio":{"data":STANDARD.encode(&audio.wav),"format":"wav"}});
    if let Some(language) = &opts.language {
        body["language"] = json!(language);
    }
    if opts.zero_retention {
        body["provider"] = json!({"zdr":true,"data_collection":"deny"});
    }
    body
}

fn bias_field(provider: &str) -> &'static str {
    if provider == "mistral" {
        "context_bias"
    } else {
        "prompt"
    }
}

fn retryable(error: &TranscribeError) -> bool {
    matches!(
        error,
        TranscribeError::RateLimited
            | TranscribeError::Network(_)
            | TranscribeError::Unavailable(_)
    )
}

#[derive(Deserialize)]
struct Usage {
    cost: Option<f64>,
}
#[derive(Deserialize)]
struct Response {
    text: String,
    language: Option<String>,
    usage: Option<Usage>,
}

async fn parse_response(response: reqwest::Response) -> Result<Transcript, TranscribeError> {
    let status = response.status();
    let raw = response.text().await.map_err(network)?;
    map_status(status, &raw)?;
    let response: Response =
        serde_json::from_str(&raw).map_err(|_| TranscribeError::InvalidResponse(raw))?;
    if response.text.trim().is_empty() {
        return Err(TranscribeError::InvalidResponse("empty transcript".into()));
    }
    Ok(Transcript {
        text: response.text.trim().into(),
        cost_usd: response.usage.and_then(|u| u.cost),
        language: response.language,
    })
}

fn map_status(status: StatusCode, body: &str) -> Result<(), TranscribeError> {
    match status.as_u16() {
        200..=299 => Ok(()),
        401 | 403 => Err(TranscribeError::InvalidKey),
        402 => Err(TranscribeError::Quota),
        429 => Err(TranscribeError::RateLimited),
        500..=599 => Err(TranscribeError::Unavailable(safe_error(body))),
        _ => Err(TranscribeError::InvalidResponse(format!(
            "HTTP {}: {}",
            status.as_u16(),
            safe_error(body)
        ))),
    }
}
fn safe_error(raw: &str) -> String {
    serde_json::from_str::<serde_json::Value>(raw)
        .ok()
        .and_then(|v| {
            v.pointer("/error/message")
                .and_then(|v| v.as_str())
                .map(str::to_owned)
        })
        .unwrap_or_else(|| "provider request failed".into())
}
fn network(error: reqwest::Error) -> TranscribeError {
    TranscribeError::Network(if error.is_timeout() {
        "request timed out".into()
    } else {
        error.to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options() -> TranscribeOpts {
        TranscribeOpts {
            model: "mistralai/voxtral-mini-transcribe".into(),
            language: Some("fr".into()),
            biasing: vec!["Dictum".into()],
            zero_retention: true,
        }
    }

    #[test]
    fn openrouter_payload_contains_audio_language_and_zdr() {
        let body = openrouter_body(
            &AudioChunk {
                wav: b"RIFF-test".to_vec(),
                duration_ms: 10,
            },
            &options(),
        );
        assert_eq!(body["model"], "mistralai/voxtral-mini-transcribe");
        assert_eq!(body["language"], "fr");
        assert_eq!(body["input_audio"]["format"], "wav");
        assert_eq!(body["input_audio"]["data"], STANDARD.encode(b"RIFF-test"));
        assert_eq!(body["provider"]["zdr"], true);
        assert_eq!(body["provider"]["data_collection"], "deny");
    }

    #[test]
    fn native_mistral_uses_context_bias_and_local_uses_prompt() {
        assert_eq!(bias_field("mistral"), "context_bias");
        assert_eq!(bias_field("local"), "prompt");
    }

    #[test]
    fn maps_auth_quota_rate_limit_and_server_errors() {
        assert!(matches!(
            map_status(StatusCode::UNAUTHORIZED, ""),
            Err(TranscribeError::InvalidKey)
        ));
        assert!(matches!(
            map_status(StatusCode::PAYMENT_REQUIRED, ""),
            Err(TranscribeError::Quota)
        ));
        assert!(matches!(
            map_status(StatusCode::TOO_MANY_REQUESTS, ""),
            Err(TranscribeError::RateLimited)
        ));
        let server = map_status(
            StatusCode::SERVICE_UNAVAILABLE,
            r#"{"error":{"message":"warming"}}"#,
        )
        .unwrap_err();
        assert!(matches!(&server, TranscribeError::Unavailable(message) if message == "warming"));
        assert!(retryable(&server));
        assert!(!retryable(&TranscribeError::InvalidKey));
    }
}
