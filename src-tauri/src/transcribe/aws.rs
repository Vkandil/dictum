//! AWS Transcribe WebSocket signing and event-stream framing. Audio stays in memory.
use super::{TranscribeError, TranscribeOpts, Transcript};
use crate::audio::AudioChunk;
use anyhow::{bail, Context, Result};
use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tokio_tungstenite::{connect_async, tungstenite::Message};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Credentials {
    pub access_key_id: String,
    pub secret_access_key: String,
    #[serde(default)]
    pub session_token: Option<String>,
}
fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
fn hmac(key: &[u8], data: &str) -> Vec<u8> {
    let mut h = Hmac::<Sha256>::new_from_slice(key).expect("HMAC key");
    h.update(data.as_bytes());
    h.finalize().into_bytes().to_vec()
}
fn encode(s: &str) -> String {
    s.bytes()
        .map(|b| {
            if b.is_ascii_alphanumeric() || b"-_.~".contains(&b) {
                (b as char).to_string()
            } else {
                format!("%{b:02X}")
            }
        })
        .collect()
}

pub fn signed_url(endpoint: &str, key: &str, language: Option<&str>) -> Result<String> {
    let creds: Credentials = serde_json::from_str(key)
        .context("Enter your AWS access key and secret in the connection settings.")?;
    let base = url::Url::parse(endpoint)?;
    let host = base.host_str().context("AWS endpoint needs a host")?;
    let region = host
        .strip_prefix("transcribestreaming.")
        .and_then(|h| h.strip_suffix(".amazonaws.com"))
        .context("Use an AWS Transcribe streaming region endpoint.")?;
    let now = Utc::now();
    let date = now.format("%Y%m%d").to_string();
    let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
    let scope = format!("{date}/{region}/transcribe/aws4_request");
    let mut params: Vec<(String, String)> = vec![
        ("X-Amz-Algorithm".into(), "AWS4-HMAC-SHA256".into()),
        (
            "X-Amz-Credential".into(),
            format!("{}/{}", creds.access_key_id, scope),
        ),
        ("X-Amz-Date".into(), amz_date.clone()),
        ("X-Amz-Expires".into(), "300".into()),
        ("X-Amz-SignedHeaders".into(), "host".into()),
        ("media-encoding".into(), "pcm".into()),
        ("sample-rate".into(), "16000".into()),
    ];
    if let Some(language) = language {
        params.push(("language-code".into(), super::vendors::locale(language)));
    } else {
        params.push(("identify-language".into(), "true".into()));
        params.push((
            "language-options".into(),
            "en-US,fr-FR,de-DE,es-ES,pt-BR,it-IT,nl-NL".into(),
        ));
    }
    if let Some(token) = &creds.session_token {
        params.push(("X-Amz-Security-Token".into(), token.clone()));
    }
    params.sort_by(|a, b| a.0.cmp(&b.0));
    let query = params
        .iter()
        .map(|(k, v)| format!("{}={}", encode(k), encode(v).replace("%3D", "%253D")))
        .collect::<Vec<_>>()
        .join("&");
    let host_header = format!("{host}:8443");
    let canonical = format!(
        "GET\n/stream-transcription-websocket\n{query}\nhost:{host_header}\n\nhost\n{}",
        hex(&Sha256::digest(b""))
    );
    let string = format!(
        "AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{}",
        hex(&Sha256::digest(canonical.as_bytes()))
    );
    let date_key = hmac(format!("AWS4{}", creds.secret_access_key).as_bytes(), &date);
    let region_key = hmac(&date_key, region);
    let service_key = hmac(&region_key, "transcribe");
    let signing_key = hmac(&service_key, "aws4_request");
    let signature = hex(&hmac(&signing_key, &string));
    Ok(format!(
        "wss://{host_header}/stream-transcription-websocket?{query}&X-Amz-Signature={signature}"
    ))
}
pub fn audio_event(pcm: &[u8]) -> Vec<u8> {
    let mut headers = Vec::new();
    for (key, value) in [
        (":content-type", "application/octet-stream"),
        (":event-type", "AudioEvent"),
        (":message-type", "event"),
    ] {
        headers.push(key.len() as u8);
        headers.extend_from_slice(key.as_bytes());
        headers.push(7);
        headers.extend_from_slice(&(value.len() as u16).to_be_bytes());
        headers.extend_from_slice(value.as_bytes());
    }
    let len = 16 + headers.len() + pcm.len();
    let mut out = Vec::with_capacity(len);
    out.extend_from_slice(&(len as u32).to_be_bytes());
    out.extend_from_slice(&(headers.len() as u32).to_be_bytes());
    let prelude = crc32fast::hash(&out);
    out.extend_from_slice(&prelude.to_be_bytes());
    out.extend_from_slice(&headers);
    out.extend_from_slice(pcm);
    let crc = crc32fast::hash(&out);
    out.extend_from_slice(&crc.to_be_bytes());
    out
}
pub fn payload(frame: &[u8]) -> Result<Value> {
    if frame.len() < 16 {
        bail!("Invalid AWS event frame");
    }
    let len = u32::from_be_bytes(frame[0..4].try_into()?) as usize;
    let headers = u32::from_be_bytes(frame[4..8].try_into()?) as usize;
    if len != frame.len()
        || headers > len - 16
        || crc32fast::hash(&frame[..8]) != u32::from_be_bytes(frame[8..12].try_into()?)
        || crc32fast::hash(&frame[..len - 4]) != u32::from_be_bytes(frame[len - 4..].try_into()?)
    {
        bail!("Invalid AWS event checksum");
    }
    Ok(serde_json::from_slice(&frame[12 + headers..len - 4])?)
}
pub async fn transcribe(
    endpoint: &str,
    key: Option<&str>,
    audio: &AudioChunk,
    opts: &TranscribeOpts,
) -> Result<Transcript, TranscribeError> {
    let url = signed_url(
        endpoint,
        key.ok_or(TranscribeError::InvalidKey)?,
        opts.language.as_deref(),
    )
    .map_err(|e| TranscribeError::InvalidResponse(e.to_string()))?;
    let (socket, _) = connect_async(url).await.map_err(|_| {
        TranscribeError::Network(
            "Could not connect to Amazon Transcribe. Check credentials and region.".into(),
        )
    })?;
    let (mut sink, mut stream) = socket.split();
    let samples = super::native::decode_wav(&audio.wav)
        .map_err(|e| TranscribeError::InvalidResponse(e.to_string()))?;
    let bytes: Vec<u8> = samples
        .into_iter()
        .flat_map(|s| ((s * 32767.0) as i16).to_le_bytes())
        .collect();
    let sender = tokio::spawn(async move {
        let mut pacing = tokio::time::interval(std::time::Duration::from_millis(100));
        for chunk in bytes.chunks(3200) {
            pacing.tick().await;
            sink.send(Message::Binary(audio_event(chunk).into()))
                .await?;
        }
        sink.send(Message::Binary(audio_event(&[]).into())).await
    });
    let mut texts = std::collections::BTreeMap::<String, String>::new();
    let result=tokio::time::timeout(std::time::Duration::from_secs(90),async{
        loop{
            let message=tokio::select!{_=opts.cancellation.cancelled()=>return Err(TranscribeError::Cancelled),m=stream.next()=>m};
            match message{
                Some(Ok(Message::Binary(raw)))=>{let v=payload(&raw).map_err(|_|TranscribeError::InvalidResponse("Invalid Amazon Transcribe event.".into()))?;if v.get("Message").is_some(){return Err(TranscribeError::Unavailable("Amazon Transcribe rejected the request. Check permissions, language and region.".into()));}
if let Some(results)=v.pointer("/Transcript/Results").and_then(Value::as_array){for r in results{if r["IsPartial"]==false{if let (Some(id),Some(text))=(r["ResultId"].as_str(),r.pointer("/Alternatives/0/Transcript").and_then(Value::as_str)){texts.insert(format!("{:020.4}-{id}",r["StartTime"].as_f64().unwrap_or(0.0)),text.into());}}}}},
                Some(Err(_))=>return Err(TranscribeError::Network("Amazon Transcribe disconnected.".into())),
                None|Some(Ok(Message::Close(_)))=>break,
                _=>{}
            }
        }
        Ok(Transcript{text:texts.values().cloned().collect::<Vec<_>>().join(" "),language:opts.language.clone(),cost_usd:None,segments:Vec::new()})
    }).await;
    sender.abort();
    result.map_err(|_| TranscribeError::Unavailable("Amazon Transcribe timed out.".into()))?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn frame_checksums_and_length() {
        let bytes = audio_event(br#"{"hello":1}"#);
        assert_eq!(payload(&bytes).unwrap()["hello"], 1);
        let mut corrupt = bytes;
        corrupt[15] ^= 1;
        assert!(payload(&corrupt).is_err());
    }
}
