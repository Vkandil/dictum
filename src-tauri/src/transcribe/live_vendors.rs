//! Streaming vendor adapters. Partial hypotheses are previewed; committed text is typed.
use super::{
    realtime::{RealtimeDialect, RealtimeEvent, RealtimeSession},
    TranscribeOpts,
};
use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::{
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use tokio::sync::mpsc;
use tokio_tungstenite::{
    connect_async,
    tungstenite::{client::IntoClientRequest, Message},
};

pub async fn connect(
    endpoint: &str,
    model: &str,
    key: Option<&str>,
    dialect: RealtimeDialect,
    opts: &TranscribeOpts,
    root: &Path,
) -> Result<RealtimeSession> {
    if dialect == RealtimeDialect::Native {
        return native(model, opts, root);
    }
    let (url,header)=match dialect{
        RealtimeDialect::OpenAiCloud=>(format!("{}/realtime?intent=transcription",ws(endpoint)),"Authorization"),
        RealtimeDialect::Deepgram=>(format!("{}/listen?model={}&encoding=linear16&sample_rate=16000&channels=1&interim_results=true&punctuate=true&language={}",ws(endpoint),model,opts.language.as_deref().unwrap_or("multi")),"Authorization"),
        RealtimeDialect::Flux=>(format!("{}/listen?model={}&encoding=linear16&sample_rate=16000",ws(endpoint).replace("/v1","/v2"),model),"Authorization"),
        RealtimeDialect::ElevenLabs=>(format!("{}/speech-to-text/realtime?model_id={model}&audio_format=pcm_16000&commit_strategy=manual&enable_logging={}",ws(endpoint),!opts.zero_retention),"xi-api-key"),
        RealtimeDialect::AssemblyAi=>(format!("{}/v3/ws?sample_rate=16000&speech_model={model}&format_turns=true", if has_host(endpoint, "api.assemblyai.com") { "wss://streaming.assemblyai.com".to_string() } else { ws(endpoint) }),"Authorization"),
        RealtimeDialect::Soniox=>(if has_host(endpoint, "api.soniox.com") { "wss://stt-rt.soniox.com".into() } else { ws(endpoint) },"Authorization"),
        RealtimeDialect::Cartesia=>(format!("{}/stt/websocket?model={model}&encoding=pcm_s16le&sample_rate=16000",ws(endpoint)),"x-api-key"),
        RealtimeDialect::Aws=>(super::aws::signed_url(endpoint,key.context("AWS credentials are missing")?,opts.language.as_deref())?,""),
        _=>anyhow::bail!("Unknown streaming protocol")
    };
    let mut request = url.into_client_request()?;
    if let Some(key) = key {
        if !header.is_empty() {
            let value = match dialect {
                RealtimeDialect::Deepgram | RealtimeDialect::Flux => format!("Token {key}"),
                RealtimeDialect::OpenAiCloud | RealtimeDialect::Soniox => format!("Bearer {key}"),
                _ => key.into(),
            };
            request.headers_mut().insert(header, value.parse()?);
        }
    }
    if dialect == RealtimeDialect::Cartesia {
        request
            .headers_mut()
            .insert("Cartesia-Version", "2025-04-16".parse()?);
    }
    let (mut socket, _) = connect_async(request)
        .await
        .context("Could not connect to the live transcription service")?;
    if dialect == RealtimeDialect::OpenAiCloud {
        let mut transcription = json!({"model":model,"keywords":opts.biasing});
        if let Some(lang) = &opts.language {
            transcription["languages"] = json!([lang]);
        }
        socket.send(Message::Text(json!({"type":"session.update","session":{"type":"transcription","audio":{"input":{"format":{"type":"audio/pcm","rate":24000},"transcription":transcription,"turn_detection":null}}}}).to_string().into())).await?;
    }
    if dialect == RealtimeDialect::Soniox {
        let mut body = json!({"model":model,"audio_format":"pcm_s16le","sample_rate":16000,"num_channels":1,"context":{"terms":opts.biasing}});
        if let Some(lang) = &opts.language {
            body["language_hints"] = json!([lang]);
        }
        socket.send(Message::Text(body.to_string().into())).await?;
    }
    let (sink, stream) = socket.split();
    let (audio_tx, mut audio_rx) = mpsc::channel::<Vec<i16>>(32);
    let (event_tx, events) = mpsc::channel(64);
    let ended = Arc::new(AtomicBool::new(false));
    let writer_end = ended.clone();
    let writer_events = event_tx.clone();
    let cancel = opts.cancellation.clone();
    let writer = tokio::spawn(async move {
        let mut sink = sink;
        let mut resampler = Resampler::default();
        loop {
            let samples = tokio::select! {_=cancel.cancelled()=>break,s=audio_rx.recv()=>s};
            let Some(samples) = samples else {
                break;
            };
            let final_audio = samples.is_empty();
            if final_audio {
                writer_end.store(true, Ordering::SeqCst);
            }
            let message = audio_message(dialect, &samples, final_audio, &mut resampler);
            if sink.send(message).await.is_err() {
                let _ = writer_events
                    .send(RealtimeEvent::Error("Live audio connection lost".into()))
                    .await;
                break;
            }
            if final_audio {
                if dialect == RealtimeDialect::Deepgram || dialect == RealtimeDialect::Flux {
                    let _ = sink
                        .send(Message::Text(
                            json!({"type":"CloseStream"}).to_string().into(),
                        ))
                        .await;
                }
                break;
            }
        }
    });
    let cancel = opts.cancellation.clone();
    tokio::spawn(async move {
        let mut stream = stream;
        let mut parser = Parser::default();
        loop {
            let message = tokio::select! {_=cancel.cancelled()=>break,m=stream.next()=>m};
            match message {
                Some(Ok(Message::Text(raw))) => {
                    if let Ok(value) = serde_json::from_str::<Value>(&raw) {
                        if let Some(event) =
                            parser.event(dialect, &value, ended.load(Ordering::SeqCst))
                        {
                            let terminal =
                                matches!(event, RealtimeEvent::Final(_) | RealtimeEvent::Error(_));
                            let _ = event_tx.send(event).await;
                            if terminal {
                                break;
                            }
                        }
                    }
                }
                Some(Ok(Message::Binary(raw))) if dialect == RealtimeDialect::Aws => {
                    if let Ok(value) = super::aws::payload(&raw) {
                        if let Some(event) =
                            parser.event(dialect, &value, ended.load(Ordering::SeqCst))
                        {
                            let _ = event_tx.send(event).await;
                        }
                    }
                }
                Some(Err(_)) => {
                    let _ = event_tx
                        .send(RealtimeEvent::Error(
                            "Live transcription connection lost".into(),
                        ))
                        .await;
                    break;
                }
                None | Some(Ok(Message::Close(_))) => {
                    if ended.load(Ordering::SeqCst) {
                        let _ = event_tx.send(RealtimeEvent::Final(parser.text())).await;
                    } else {
                        let _ = event_tx
                            .send(RealtimeEvent::Error(
                                "Live transcription disconnected before completion".into(),
                            ))
                            .await;
                    }
                    break;
                }
                _ => {}
            }
        }
        writer.abort();
    });
    Ok(RealtimeSession { audio_tx, events })
}
fn has_host(endpoint: &str, expected: &str) -> bool {
    url::Url::parse(endpoint)
        .ok()
        .is_some_and(|url| url.host_str() == Some(expected))
}
fn ws(endpoint: &str) -> String {
    endpoint
        .trim_end_matches('/')
        .replacen("https://", "wss://", 1)
        .replacen("http://", "ws://", 1)
}
#[derive(Default)]
pub struct Resampler {
    previous: [i16; 2],
    input_count: u64,
    output_count: u64,
}
impl Resampler {
    pub fn convert(&mut self, samples: &[i16]) -> Vec<i16> {
        let mut out = Vec::with_capacity(samples.len() * 3 / 2 + 2);
        for &current in samples {
            let index = self.input_count as i64;
            if index == 0 {
                self.previous = [current; 2];
            }
            self.input_count += 1;
            // A one-input-sample delay makes interpolation causal across chunks.
            // Keep the fractional phase rather than restarting on each frame.
            let target_count = self.input_count * 3 / 2;
            while self.output_count < target_count {
                let position = (self.output_count as i64 * 2 - 3).max(0);
                let left = position / 3;
                let fraction = position % 3;
                let (a, b) = if left <= index - 2 {
                    (self.previous[0], self.previous[1])
                } else if left == index - 1 {
                    (self.previous[1], current)
                } else {
                    (current, current)
                };
                out.push(((a as i64 * (3 - fraction) + b as i64 * fraction) / 3) as i16);
                self.output_count += 1;
            }
            self.previous = [self.previous[1], current];
        }
        out
    }
}
fn audio_message(
    dialect: RealtimeDialect,
    samples: &[i16],
    end: bool,
    resampler: &mut Resampler,
) -> Message {
    let pcm: Vec<u8> = if dialect == RealtimeDialect::OpenAiCloud {
        resampler
            .convert(samples)
            .into_iter()
            .flat_map(i16::to_le_bytes)
            .collect()
    } else {
        samples.iter().flat_map(|s| s.to_le_bytes()).collect()
    };
    if end {
        return match dialect{
        RealtimeDialect::OpenAiCloud=>Message::Text(json!({"type":"input_audio_buffer.commit"}).to_string().into()),
        RealtimeDialect::ElevenLabs=>Message::Text(json!({"message_type":"input_audio_chunk","audio_base_64":"","commit":true,"sample_rate":16000}).to_string().into()),
        RealtimeDialect::AssemblyAi=>Message::Text(json!({"type":"Terminate"}).to_string().into()),
        RealtimeDialect::Soniox=>Message::Text("".into()),
        RealtimeDialect::Cartesia=>Message::Text(json!({"type":"finalize"}).to_string().into()),
        RealtimeDialect::Aws=>Message::Binary(super::aws::audio_event(&[]).into()),
        _=>Message::Text(json!({"type":"Finalize"}).to_string().into())
    };
    }
    match dialect{
        RealtimeDialect::OpenAiCloud=>Message::Text(json!({"type":"input_audio_buffer.append","audio":STANDARD.encode(pcm)}).to_string().into()),
        RealtimeDialect::ElevenLabs=>Message::Text(json!({"message_type":"input_audio_chunk","audio_base_64":STANDARD.encode(pcm),"commit":false,"sample_rate":16000}).to_string().into()),
        RealtimeDialect::Aws=>Message::Binary(super::aws::audio_event(&pcm).into()),
        _=>Message::Binary(pcm.into())
    }
}
#[derive(Default)]
pub struct Parser {
    committed: String,
    partial: String,
    turns: std::collections::BTreeMap<u64, String>,
    aws_results: std::collections::BTreeMap<String, String>,
}
impl Parser {
    fn text(&self) -> String {
        let space = !self.committed.is_empty()
            && !self.partial.is_empty()
            && !self.committed.ends_with(char::is_whitespace)
            && !self.partial.starts_with(char::is_whitespace);
        format!(
            "{}{}{}",
            self.committed,
            if space { " " } else { "" },
            self.partial
        )
    }
    fn commit(&mut self, text: &str) {
        if !self.committed.is_empty()
            && !self.committed.ends_with(char::is_whitespace)
            && !text.starts_with(char::is_whitespace)
        {
            self.committed.push(' ');
        }
        self.committed.push_str(text);
        self.partial.clear();
    }
    pub fn event(
        &mut self,
        dialect: RealtimeDialect,
        v: &Value,
        ended: bool,
    ) -> Option<RealtimeEvent> {
        let kind = v["type"]
            .as_str()
            .or_else(|| v["message_type"].as_str())
            .unwrap_or("");
        if kind == "error"
            || kind.contains("error")
            || v.get("error_code").is_some()
            || matches!(kind, "rate_limited" | "auth_error" | "quota_exceeded")
        {
            return Some(RealtimeEvent::Error(
                "The live service rejected the request. Check the key, model and account credits."
                    .into(),
            ));
        }
        match dialect {
            RealtimeDialect::OpenAiCloud => {
                if kind.ends_with("input_audio_transcription.delta") {
                    self.partial.push_str(v["delta"].as_str().unwrap_or(""));
                } else if kind.ends_with("input_audio_transcription.completed") {
                    self.commit(v["transcript"].as_str().unwrap_or(""));
                    return Some(if ended {
                        RealtimeEvent::Final(self.text())
                    } else {
                        RealtimeEvent::Committed(self.text())
                    });
                } else {
                    return None;
                }
            }
            RealtimeDialect::ElevenLabs => {
                if kind == "partial_transcript" {
                    self.partial = v["text"].as_str().unwrap_or("").into();
                } else if kind == "committed_transcript" {
                    self.commit(v["text"].as_str().unwrap_or(""));
                    return Some(if ended {
                        RealtimeEvent::Final(self.text())
                    } else {
                        RealtimeEvent::Committed(self.text())
                    });
                } else if kind == "warning" {
                    return Some(RealtimeEvent::Error("The service did not apply the requested retention policy. Choose a compatible account or service.".into()));
                } else {
                    return None;
                }
            }
            RealtimeDialect::Deepgram => {
                let text = v
                    .pointer("/channel/alternatives/0/transcript")
                    .and_then(Value::as_str)?;
                if v["is_final"] == true {
                    self.commit(text);
                    return Some(RealtimeEvent::Committed(self.text()));
                }
                self.partial = text.into();
            }
            RealtimeDialect::Flux => {
                if kind != "TurnInfo" {
                    return None;
                }
                let text = v["transcript"].as_str().unwrap_or("");
                if v["event"] == "EndOfTurn" {
                    self.commit(text);
                    return Some(RealtimeEvent::Committed(self.text()));
                }
                self.partial = text.into();
            }
            RealtimeDialect::AssemblyAi => {
                if kind == "Termination" {
                    return Some(RealtimeEvent::Final(self.committed.trim().into()));
                }
                if kind != "Turn" {
                    return None;
                }
                let text = v["transcript"].as_str().unwrap_or("");
                let index = v["turn_order"].as_u64().unwrap_or(0);
                if v["end_of_turn"] == true {
                    self.turns.insert(index, text.into());
                    self.committed = self.turns.values().cloned().collect::<Vec<_>>().join(" ");
                    self.partial.clear();
                    return Some(RealtimeEvent::Committed(self.text()));
                }
                self.partial = text.into();
            }
            RealtimeDialect::Soniox => {
                self.partial.clear();
                for token in v["tokens"].as_array().into_iter().flatten() {
                    let text = token["text"].as_str().unwrap_or("");
                    if text.starts_with('<') && text.ends_with('>') {
                        continue;
                    }
                    if token["is_final"] == true {
                        self.committed.push_str(text);
                    } else {
                        self.partial.push_str(text);
                    }
                }
                if v["finished"] == true {
                    return Some(RealtimeEvent::Final(self.text()));
                }
                return Some(RealtimeEvent::Committed(self.committed.clone()));
            }
            RealtimeDialect::Cartesia => {
                let text = v["text"].as_str().unwrap_or("");
                if v["is_final"] == true {
                    self.commit(text);
                    return Some(if ended {
                        RealtimeEvent::Final(self.text())
                    } else {
                        RealtimeEvent::Committed(self.text())
                    });
                }
                self.partial = text.into();
            }
            RealtimeDialect::Aws => {
                let mut final_received = false;
                for r in v
                    .pointer("/Transcript/Results")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                {
                    let text = r
                        .pointer("/Alternatives/0/Transcript")
                        .and_then(Value::as_str)
                        .unwrap_or("");
                    if r["IsPartial"] == false {
                        if let Some(id) = r["ResultId"].as_str() {
                            self.aws_results.insert(
                                format!("{:020.4}-{id}", r["StartTime"].as_f64().unwrap_or(0.0)),
                                text.into(),
                            );
                            final_received = true;
                        }
                    } else {
                        self.partial = text.into();
                    }
                }
                if final_received {
                    self.committed = self
                        .aws_results
                        .values()
                        .cloned()
                        .collect::<Vec<_>>()
                        .join(" ");
                    self.partial.clear();
                    return Some(RealtimeEvent::Committed(self.text()));
                }
            }
            _ => return None,
        }
        Some(RealtimeEvent::Partial(self.text()))
    }
}
fn native(model_id: &str, opts: &TranscribeOpts, root: &Path) -> Result<RealtimeSession> {
    let model = super::native::model(model_id)?;
    let root = root.to_owned();
    let options = opts.clone();
    let (audio_tx, mut audio_rx) = mpsc::channel::<Vec<i16>>(32);
    let (event_tx, events) = mpsc::channel(64);
    std::thread::spawn(move || {
        let result = super::native::with_online(&root, &model, |recognizer| {
            let stream = recognizer.create_stream();
            if let Some(lang) = &options.language {
                stream.set_option("language", lang);
            }
            let mut committed = String::new();
            while let Some(samples) = audio_rx.blocking_recv() {
                if options.cancellation.is_cancelled() {
                    break;
                }
                let end = samples.is_empty();
                let samples: Vec<f32> = samples.into_iter().map(|s| s as f32 / 32768.0).collect();
                stream.accept_waveform(16000, &samples);
                if end {
                    stream.accept_waveform(16000, &vec![0.0; 8000]);
                    stream.input_finished();
                }
                while recognizer.is_ready(&stream) {
                    recognizer.decode(&stream);
                }
                let text = recognizer
                    .get_result(&stream)
                    .map(|r| r.text)
                    .unwrap_or_default();
                let text = if committed.is_empty() {
                    text
                } else {
                    format!("{committed} {text}")
                };
                let event = if end {
                    RealtimeEvent::Final(text)
                } else if recognizer.is_endpoint(&stream) {
                    committed = text.clone();
                    recognizer.reset(&stream);
                    RealtimeEvent::Committed(text)
                } else {
                    RealtimeEvent::Partial(text)
                };
                if event_tx.blocking_send(event).is_err() || end {
                    break;
                }
            }
            Ok(())
        });
        if let Err(e) = result {
            let _ = event_tx.blocking_send(RealtimeEvent::Error(e.to_string()));
        }
    });
    Ok(RealtimeSession { audio_tx, events })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cloud_rewrites_never_match_a_local_path_or_a_similar_hostname() {
        assert!(has_host("https://api.soniox.com/v1", "api.soniox.com"));
        assert!(!has_host(
            "http://localhost/proxy/api.soniox.com",
            "api.soniox.com"
        ));
        assert!(!has_host(
            "https://api.assemblyai.com.example.org/v2",
            "api.assemblyai.com"
        ));
    }
    #[tokio::test]
    async fn openai_session_resamples_audio_and_commits_final_text() {
        use tokio_tungstenite::accept_async;
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (socket, _) = listener.accept().await.unwrap();
            let mut socket = accept_async(socket).await.unwrap();
            let setup = socket.next().await.unwrap().unwrap();
            let value: Value = serde_json::from_str(setup.to_text().unwrap()).unwrap();
            assert_eq!(value["session"]["audio"]["input"]["format"]["rate"], 24000);
            assert_eq!(
                value["session"]["audio"]["input"]["transcription"]["model"],
                "gpt-live-transcribe"
            );
            let audio = socket.next().await.unwrap().unwrap();
            let value: Value = serde_json::from_str(audio.to_text().unwrap()).unwrap();
            assert_eq!(
                STANDARD
                    .decode(value["audio"].as_str().unwrap())
                    .unwrap()
                    .len(),
                12
            );
            socket.send(Message::Text(json!({"type":"conversation.item.input_audio_transcription.delta","delta":"Bon"}).to_string().into())).await.unwrap();
            let commit = socket.next().await.unwrap().unwrap();
            let value: Value = serde_json::from_str(commit.to_text().unwrap()).unwrap();
            assert_eq!(value["type"], "input_audio_buffer.commit");
            socket.send(Message::Text(json!({"type":"conversation.item.input_audio_transcription.completed","transcript":"Bonjour"}).to_string().into())).await.unwrap();
        });
        let opts = TranscribeOpts {
            model: "gpt-live-transcribe".into(),
            language: Some("fr".into()),
            biasing: vec!["Dictum".into()],
            zero_retention: true,
            cancellation: tokio_util::sync::CancellationToken::new(),
        };
        let mut session = connect(
            &format!("http://{address}/v1"),
            &opts.model,
            Some("fixture"),
            RealtimeDialect::OpenAiCloud,
            &opts,
            Path::new("."),
        )
        .await
        .unwrap();
        let tx = session.sender();
        tx.send(vec![0, 300, 600, 900]).await.unwrap();
        assert_eq!(
            session.events.recv().await,
            Some(RealtimeEvent::Partial("Bon".into()))
        );
        tx.send(Vec::new()).await.unwrap();
        assert_eq!(
            session.events.recv().await,
            Some(RealtimeEvent::Final("Bonjour".into()))
        );
        server.await.unwrap();
    }
    #[test]
    fn partials_are_replaced_not_appended() {
        let mut p = Parser::default();
        assert_eq!(
            p.event(
                RealtimeDialect::ElevenLabs,
                &json!({"message_type":"partial_transcript","text":"Bonjour"}),
                false
            ),
            Some(RealtimeEvent::Partial("Bonjour".into()))
        );
        assert_eq!(
            p.event(
                RealtimeDialect::ElevenLabs,
                &json!({"message_type":"partial_transcript","text":"Bonsoir"}),
                false
            ),
            Some(RealtimeEvent::Partial("Bonsoir".into()))
        );
        assert_eq!(
            p.event(
                RealtimeDialect::ElevenLabs,
                &json!({"message_type":"committed_transcript","text":"Bonsoir"}),
                true
            ),
            Some(RealtimeEvent::Final("Bonsoir".into()))
        );
    }
    #[test]
    fn soniox_ends_with_empty_text_not_binary() {
        assert_eq!(
            audio_message(
                RealtimeDialect::Soniox,
                &[],
                true,
                &mut Resampler::default()
            ),
            Message::Text("".into())
        );
    }
    #[test]
    fn openai_audio_is_resampled() {
        let msg = audio_message(
            RealtimeDialect::OpenAiCloud,
            &[1, 2, 3, 4],
            false,
            &mut Resampler::default(),
        );
        let v: Value = serde_json::from_str(msg.to_text().unwrap()).unwrap();
        assert_eq!(
            STANDARD.decode(v["audio"].as_str().unwrap()).unwrap().len(),
            12
        );
    }
    #[test]
    fn resampling_preserves_phase_across_odd_chunks() {
        let input = [0, 300, 600, 900, 1200, 1500, 1800];
        let expected = Resampler::default().convert(&input);
        let mut streaming = Resampler::default();
        let actual: Vec<_> = input
            .chunks(1)
            .flat_map(|chunk| streaming.convert(chunk))
            .collect();
        assert_eq!(actual, expected);
        assert_eq!(actual.len(), input.len() * 3 / 2);
        assert_eq!(&actual[..6], &[0, 0, 100, 300, 500, 700]);
    }
}
