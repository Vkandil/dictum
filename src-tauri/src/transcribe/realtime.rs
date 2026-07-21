//! Realtime transcription transports for Mistral cloud and OpenAI-compatible
//! local servers such as vLLM. Both dialects carry base64 PCM16 at 16 kHz.

use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tokio::sync::mpsc;
use tokio_tungstenite::{
    connect_async,
    tungstenite::{client::IntoClientRequest, Message},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RealtimeDialect {
    Mistral,
    OpenAiCompatible,
}

impl RealtimeDialect {
    pub fn for_provider(provider: &str) -> Self {
        if provider == "mistral" {
            Self::Mistral
        } else {
            Self::OpenAiCompatible
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RealtimeEvent {
    Partial(String),
    Final(String),
    Error(String),
}

pub struct RealtimeSession {
    audio_tx: mpsc::Sender<Vec<i16>>,
    pub events: mpsc::Receiver<RealtimeEvent>,
}

impl RealtimeSession {
    pub async fn connect(
        endpoint: &str,
        model: &str,
        api_key: Option<&str>,
        dialect: RealtimeDialect,
    ) -> Result<Self> {
        let url = realtime_url(endpoint, model, dialect)?;
        let mut request = url.into_client_request()?;
        if let Some(key) = api_key {
            request
                .headers_mut()
                .insert("Authorization", format!("Bearer {key}").parse()?);
        }
        let (mut socket, _) = connect_async(request)
            .await
            .context("realtime connection failed")?;

        // vLLM sends session.created first, then requires the served model in
        // session.update. Mistral carries the model in the URL query.
        if dialect == RealtimeDialect::OpenAiCompatible {
            let first = tokio::time::timeout(std::time::Duration::from_secs(5), socket.next())
                .await
                .context("realtime server did not create a session")?
                .context("realtime server closed before session creation")??;
            ensure_session_created(&first)?;
            socket
                .send(Message::Text(
                    json!({"type":"session.update","model":model})
                        .to_string()
                        .into(),
                ))
                .await?;
        }

        let (mut sink, mut stream) = socket.split();
        let (audio_tx, mut audio_rx) = mpsc::channel::<Vec<i16>>(32);
        let (event_tx, events) = mpsc::channel(64);

        tokio::spawn(async move {
            while let Some(samples) = audio_rx.recv().await {
                if samples.is_empty() {
                    let commit = if dialect == RealtimeDialect::OpenAiCompatible {
                        json!({"type":"input_audio_buffer.commit","final":true})
                    } else {
                        json!({"type":"input_audio_buffer.commit"})
                    };
                    let _ = sink.send(Message::Text(commit.to_string().into())).await;
                    break;
                }
                let bytes: Vec<u8> = samples.into_iter().flat_map(i16::to_le_bytes).collect();
                let payload =
                    json!({"type":"input_audio_buffer.append","audio":STANDARD.encode(bytes)});
                if sink
                    .send(Message::Text(payload.to_string().into()))
                    .await
                    .is_err()
                {
                    break;
                }
            }
        });

        tokio::spawn(async move {
            let mut transcript = String::new();
            while let Some(message) = stream.next().await {
                match message {
                    Ok(Message::Text(raw)) => {
                        if let Some(event) = parse_server_event(&raw, &mut transcript) {
                            let terminal =
                                matches!(event, RealtimeEvent::Final(_) | RealtimeEvent::Error(_));
                            let _ = event_tx.send(event).await;
                            if terminal {
                                break;
                            }
                        }
                    }
                    Err(error) => {
                        let _ = event_tx.send(RealtimeEvent::Error(error.to_string())).await;
                        break;
                    }
                    _ => {}
                }
            }
        });
        Ok(Self { audio_tx, events })
    }

    pub fn sender(&self) -> mpsc::Sender<Vec<i16>> {
        self.audio_tx.clone()
    }
}

fn realtime_url(endpoint: &str, model: &str, dialect: RealtimeDialect) -> Result<String> {
    let websocket_base = endpoint
        .trim_end_matches('/')
        .replacen("https://", "wss://", 1)
        .replacen("http://", "ws://", 1);
    let url = match dialect {
        RealtimeDialect::Mistral => format!(
            "{websocket_base}/audio/transcriptions/realtime?model={}",
            percent_encode(model)
        ),
        RealtimeDialect::OpenAiCompatible => format!("{websocket_base}/realtime"),
    };
    let parsed = url::Url::parse(&url)?;
    anyhow::ensure!(
        matches!(parsed.scheme(), "ws" | "wss"),
        "realtime endpoint must use HTTP(S) or WS(S)"
    );
    Ok(url)
}

fn ensure_session_created(message: &Message) -> Result<()> {
    let Message::Text(raw) = message else {
        anyhow::bail!("realtime server returned a non-text session event")
    };
    let value: serde_json::Value = serde_json::from_str(raw)?;
    anyhow::ensure!(
        value.get("type").and_then(|v| v.as_str()) == Some("session.created"),
        "realtime server did not return session.created"
    );
    Ok(())
}

fn parse_server_event(raw: &str, transcript: &mut String) -> Option<RealtimeEvent> {
    let value: serde_json::Value = serde_json::from_str(raw).ok()?;
    let event_type = value.get("type").and_then(|v| v.as_str()).unwrap_or("");
    if event_type == "transcription.delta" || event_type.ends_with("transcription.delta") {
        let delta = value
            .get("delta")
            .or_else(|| value.get("text"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        transcript.push_str(delta);
        return Some(RealtimeEvent::Partial(transcript.clone()));
    }
    if event_type == "transcription.done"
        || event_type.ends_with("transcription.completed")
        || event_type.ends_with("transcription.done")
    {
        let final_text = value
            .get("text")
            .or_else(|| value.get("transcript"))
            .and_then(|v| v.as_str())
            .filter(|text| !text.is_empty())
            .unwrap_or(transcript);
        return Some(RealtimeEvent::Final(final_text.to_string()));
    }
    if event_type == "error" || event_type.ends_with(".error") {
        let message = value
            .pointer("/error/message")
            .or_else(|| value.get("message"))
            .and_then(|v| v.as_str())
            .unwrap_or("realtime provider error");
        return Some(RealtimeEvent::Error(message.to_string()));
    }
    None
}

fn percent_encode(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| {
            if byte.is_ascii_alphanumeric() || b"-_.~".contains(&byte) {
                vec![byte as char]
            } else {
                format!("%{byte:02X}").chars().collect()
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::TcpListener;
    use tokio_tungstenite::accept_async;

    #[test]
    fn builds_each_provider_url() {
        assert_eq!(
            realtime_url(
                "http://localhost:8000/v1",
                "voxtral/model",
                RealtimeDialect::OpenAiCompatible
            )
            .unwrap(),
            "ws://localhost:8000/v1/realtime"
        );
        assert_eq!(
            realtime_url(
                "https://api.mistral.ai/v1",
                "voxtral/model",
                RealtimeDialect::Mistral
            )
            .unwrap(),
            "wss://api.mistral.ai/v1/audio/transcriptions/realtime?model=voxtral%2Fmodel"
        );
    }

    #[test]
    fn accumulates_deltas_and_finalizes() {
        let mut text = String::new();
        assert_eq!(
            parse_server_event(
                r#"{"type":"transcription.delta","delta":"Hello "}"#,
                &mut text
            ),
            Some(RealtimeEvent::Partial("Hello ".into()))
        );
        assert_eq!(
            parse_server_event(
                r#"{"type":"transcription.delta","delta":"world"}"#,
                &mut text
            ),
            Some(RealtimeEvent::Partial("Hello world".into()))
        );
        assert_eq!(
            parse_server_event(r#"{"type":"transcription.done"}"#, &mut text),
            Some(RealtimeEvent::Final("Hello world".into()))
        );
    }

    #[tokio::test]
    async fn vllm_handshake_audio_and_commit_round_trip() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let mut socket = accept_async(stream).await.unwrap();
            socket
                .send(Message::Text(
                    json!({"type":"session.created"}).to_string().into(),
                ))
                .await
                .unwrap();
            let update = socket.next().await.unwrap().unwrap().into_text().unwrap();
            assert_eq!(
                serde_json::from_str::<serde_json::Value>(&update).unwrap()["type"],
                "session.update"
            );
            let append = socket.next().await.unwrap().unwrap().into_text().unwrap();
            assert_eq!(
                serde_json::from_str::<serde_json::Value>(&append).unwrap()["type"],
                "input_audio_buffer.append"
            );
            socket
                .send(Message::Text(
                    json!({"type":"transcription.delta","delta":"live"})
                        .to_string()
                        .into(),
                ))
                .await
                .unwrap();
            let commit = socket.next().await.unwrap().unwrap().into_text().unwrap();
            assert_eq!(
                serde_json::from_str::<serde_json::Value>(&commit).unwrap()["final"],
                true
            );
            socket
                .send(Message::Text(
                    json!({"type":"transcription.done"}).to_string().into(),
                ))
                .await
                .unwrap();
        });

        let mut session = RealtimeSession::connect(
            &format!("http://{address}/v1"),
            "test-model",
            None,
            RealtimeDialect::OpenAiCompatible,
        )
        .await
        .unwrap();
        let tx = session.sender();
        tx.send(vec![1, -2, 3]).await.unwrap();
        assert_eq!(
            session.events.recv().await,
            Some(RealtimeEvent::Partial("live".into()))
        );
        tx.send(Vec::new()).await.unwrap();
        assert_eq!(
            session.events.recv().await,
            Some(RealtimeEvent::Final("live".into()))
        );
        server.await.unwrap();
    }
}
