//! Native vendor contracts. Manifests remain data, never executable plugins.
use super::{
    generic::{map_status, network},
    HttpTranscriptionProvider, TranscribeError, TranscribeOpts, Transcript,
};
use crate::audio::AudioChunk;
use reqwest::{multipart, RequestBuilder};
use serde_json::{json, Value};
use std::time::Duration;
use tokio::time::{sleep, Instant};

/// Cleans up only jobs/files created by this request, including when its future is cancelled.
struct RemoteCleanup(Vec<RequestBuilder>);
impl Drop for RemoteCleanup {
    fn drop(&mut self) {
        if let Ok(handle) = tokio::runtime::Handle::try_current() {
            let requests = std::mem::take(&mut self.0);
            handle.spawn(async move {
                for request in requests {
                    let _ = request.timeout(Duration::from_secs(5)).send().await;
                }
            });
        }
    }
}

impl HttpTranscriptionProvider {
    pub(super) async fn value(&self, request: RequestBuilder) -> Result<Value, TranscribeError> {
        let response = self.authorize(request).send().await.map_err(network)?;
        let status = response.status();
        let raw = response.text().await.map_err(network)?;
        map_status(status, &raw)?;
        serde_json::from_str(&raw).map_err(|_| {
            TranscribeError::InvalidResponse("The service returned unreadable JSON.".into())
        })
    }
    fn at(&self, path: &str) -> String {
        format!("{}{}", self.manifest.base_url.trim_end_matches('/'), path)
    }
    fn file(audio: &AudioChunk) -> multipart::Part {
        multipart::Part::bytes(audio.wav.clone())
            .file_name("dictum.wav")
            .mime_str("audio/wav")
            .expect("WAV MIME")
    }
    async fn poll(&self, url: &str, protocol: &str) -> Result<Value, TranscribeError> {
        let deadline = Instant::now() + Duration::from_secs(180);
        loop {
            if Instant::now() >= deadline {
                return Err(TranscribeError::Unavailable(
                    "The transcription job took too long. Retry a shorter recording.".into(),
                ));
            }
            let value = self.value(self.client.get(url)).await?;
            let status = value
                .pointer("/job/status")
                .or_else(|| value.get("status"))
                .and_then(Value::as_str)
                .unwrap_or("");
            if matches!(status, "completed" | "done" | "transcribed") {
                return Ok(value);
            }
            if matches!(status, "error" | "failed" | "rejected") {
                return Err(TranscribeError::Unavailable(
                    "The service could not process this recording.".into(),
                ));
            }
            if protocol == "revai" && status == "transcribed" {
                return Ok(value);
            }
            tokio::select! { _ = sleep(Duration::from_millis(500)) => {} }
        }
    }
    pub(super) async fn vendor_request(
        &self,
        audio: &AudioChunk,
        opts: &TranscribeOpts,
    ) -> Result<Transcript, TranscribeError> {
        match self.manifest.protocol.as_str() {
            "elevenlabs" => {
                let mut form = multipart::Form::new()
                    .part("file", Self::file(audio))
                    .text("model_id", opts.model.clone())
                    .text("tag_audio_events", "false");
                if let Some(lang) = &opts.language {
                    form = form.text("language_code", lang.clone());
                }
                for term in &opts.biasing {
                    form = form.text("keyterms", term.clone());
                }
                let value = self
                    .value(
                        self.client
                            .post(self.at("/speech-to-text"))
                            .query(&[("enable_logging", !opts.zero_retention)])
                            .multipart(form),
                    )
                    .await?;
                transcript(&value, "/text")
            }
            "deepgram" => {
                let mut query = vec![
                    ("model".to_string(), opts.model.clone()),
                    ("punctuate".into(), "true".into()),
                    ("smart_format".into(), "true".into()),
                    ("mip_opt_out".into(), opts.zero_retention.to_string()),
                ];
                if let Some(lang) = &opts.language {
                    query.push(("language".into(), lang.clone()));
                } else {
                    query.push(("detect_language".into(), "true".into()));
                }
                for term in &opts.biasing {
                    query.push((
                        if opts.model == "nova-3" {
                            "keyterm"
                        } else {
                            "keywords"
                        }
                        .into(),
                        term.clone(),
                    ));
                }
                let value = self
                    .value(
                        self.client
                            .post(self.at("/listen"))
                            .query(&query)
                            .header("Content-Type", "audio/wav")
                            .body(audio.wav.clone()),
                    )
                    .await?;
                transcript(&value, "/results/channels/0/alternatives/0/transcript")
            }
            "assemblyai" => {
                let upload = self
                    .value(
                        self.client
                            .post(self.at("/upload"))
                            .header("Content-Type", "application/octet-stream")
                            .body(audio.wav.clone()),
                    )
                    .await?;
                let mut body = json!({"audio_url": field(&upload,"upload_url")?, "speech_models":[opts.model], "punctuate":true, "format_text":true});
                if let Some(lang) = &opts.language {
                    body["language_code"] = json!(lang);
                } else {
                    body["language_detection"] = json!(true);
                }
                if !opts.biasing.is_empty() {
                    body["keyterms_prompt"] = json!(opts.biasing);
                }
                let job = self
                    .value(self.client.post(self.at("/transcript")).json(&body))
                    .await?;
                let url = self.at(&format!("/transcript/{}", safe_id(&job)?));
                let _cleanup = RemoteCleanup(vec![self.authorize(self.client.delete(&url))]);
                transcript(&self.poll(&url, "assemblyai").await?, "/text")
            }
            "soniox" => {
                let upload = self
                    .value(
                        self.client
                            .post(self.at("/files"))
                            .multipart(multipart::Form::new().part("file", Self::file(audio))),
                    )
                    .await?;
                let file_id = safe_id(&upload)?;
                let mut cleanup = RemoteCleanup(vec![
                    self.authorize(self.client.delete(self.at(&format!("/files/{file_id}"))))
                ]);
                let mut body =
                    json!({"model": opts.model,"file_id":file_id,"context":{"terms":opts.biasing}});
                if let Some(lang) = &opts.language {
                    body["language_hints"] = json!([lang]);
                }
                let job = self
                    .value(self.client.post(self.at("/transcriptions")).json(&body))
                    .await?;
                let url = self.at(&format!("/transcriptions/{}", safe_id(&job)?));
                cleanup
                    .0
                    .insert(0, self.authorize(self.client.delete(&url)));
                self.poll(&url, "soniox").await?;
                let value = self
                    .value(self.client.get(format!("{url}/transcript")))
                    .await?;
                if value.get("text").is_some() {
                    transcript(&value, "/text")
                } else {
                    let text = value["tokens"]
                        .as_array()
                        .ok_or_else(|| invalid("tokens"))?
                        .iter()
                        .filter_map(|t| t["text"].as_str())
                        .collect::<String>();
                    transcript(&json!({"text":text,"segments":value["tokens"]}), "/text")
                }
            }
            "gladia" => {
                let upload = self
                    .value(
                        self.client
                            .post(self.at("/upload"))
                            .multipart(multipart::Form::new().part("audio", Self::file(audio))),
                    )
                    .await?;
                let mut body = json!({"audio_url": field(&upload,"audio_url")?,"model":opts.model,"custom_vocabulary":!opts.biasing.is_empty(),"custom_vocabulary_config":{"vocabulary":opts.biasing.iter().map(|t|json!({"value":t})).collect::<Vec<_>>()}});
                if let Some(lang) = &opts.language {
                    body["language_config"] = json!({"languages":[lang],"code_switching":false});
                }
                let job = self
                    .value(self.client.post(self.at("/pre-recorded")).json(&body))
                    .await?;
                let url = self.at(&format!("/pre-recorded/{}", safe_id(&job)?));
                let _cleanup = RemoteCleanup(vec![self.authorize(self.client.delete(&url))]);
                transcript(
                    &self.poll(&url, "gladia").await?,
                    "/result/transcription/full_transcript",
                )
            }
            "speechmatics" => {
                let config = json!({"type":"transcription","transcription_config":{"language":opts.language.as_deref().unwrap_or("auto"),"operating_point":opts.model,"additional_vocab":opts.biasing.iter().map(|t|json!({"content":t})).collect::<Vec<_>>()}});
                let form = multipart::Form::new()
                    .part("data_file", Self::file(audio))
                    .text("config", config.to_string());
                let job = self
                    .value(self.client.post(self.at("/jobs")).multipart(form))
                    .await?;
                let url = self.at(&format!("/jobs/{}", safe_id(&job)?));
                let _cleanup = RemoteCleanup(vec![self.authorize(self.client.delete(&url))]);
                self.poll(&url, "speechmatics").await?;
                let value = self
                    .value(self.client.get(format!("{url}/transcript?format=json-v2")))
                    .await?;
                let text = value["results"]
                    .as_array()
                    .ok_or_else(|| invalid("results"))?
                    .iter()
                    .filter_map(|t| t.pointer("/alternatives/0/content").and_then(Value::as_str))
                    .collect::<Vec<_>>()
                    .join(" ");
                transcript(&json!({"text":text,"segments":value["results"]}), "/text")
            }
            "revai" => {
                let mut options = json!({"skip_diarization":true});
                if let Some(lang) = &opts.language {
                    options["language"] = json!(lang);
                }
                let form = multipart::Form::new()
                    .part("media", Self::file(audio))
                    .text("options", options.to_string());
                let job = self
                    .value(self.client.post(self.at("/jobs")).multipart(form))
                    .await?;
                let url = self.at(&format!("/jobs/{}", safe_id(&job)?));
                let _cleanup = RemoteCleanup(vec![self.authorize(self.client.delete(&url))]);
                self.poll(&url, "revai").await?;
                let value = self
                    .value(
                        self.client
                            .get(format!("{url}/transcript"))
                            .header("Accept", "application/vnd.rev.transcript.v1.0+json"),
                    )
                    .await?;
                let text = value["monologues"]
                    .as_array()
                    .ok_or_else(|| invalid("monologues"))?
                    .iter()
                    .flat_map(|m| m["elements"].as_array().into_iter().flatten())
                    .filter_map(|e| e["value"].as_str())
                    .collect::<String>();
                transcript(
                    &json!({"text":text,"segments":value["monologues"]}),
                    "/text",
                )
            }
            "sarvam" => {
                let form = multipart::Form::new()
                    .part("file", Self::file(audio))
                    .text("model", opts.model.clone())
                    .text("mode", "transcribe")
                    .text(
                        "language_code",
                        opts.language
                            .as_deref()
                            .map(locale)
                            .unwrap_or("unknown".into()),
                    );
                let value = self
                    .value(self.client.post(self.at("/speech-to-text")).multipart(form))
                    .await?;
                transcript(&value, "/transcript")
            }
            "cartesia" => {
                let mut form = multipart::Form::new()
                    .part("file", Self::file(audio))
                    .text("model", opts.model.clone());
                if let Some(lang) = &opts.language {
                    form = form.text("language", lang.clone());
                }
                transcript(
                    &self
                        .value(self.client.post(self.at("/stt")).multipart(form))
                        .await?,
                    "/text",
                )
            }
            "azure" => {
                let definition = if let Some(lang) = &opts.language {
                    json!({"locales":[locale(lang)]})
                } else {
                    json!({})
                };
                let form = multipart::Form::new()
                    .part("audio", Self::file(audio))
                    .text("definition", definition.to_string());
                let value = self
                    .value(
                        self.client
                            .post(self.at(
                                "/speechtotext/transcriptions:transcribe?api-version=2025-10-15",
                            ))
                            .multipart(form),
                    )
                    .await?;
                let text = value["combinedPhrases"]
                    .as_array()
                    .ok_or_else(|| invalid("combinedPhrases"))?
                    .iter()
                    .filter_map(|p| p["text"].as_str())
                    .collect::<Vec<_>>()
                    .join(" ");
                transcript(&json!({"text":text,"segments":value["phrases"]}), "/text")
            }
            "googlecloud" => {
                // The configured endpoint includes the project/location/recognizer resource.
                let body = json!({"config":{"autoDecodingConfig":{},"languageCodes":[opts.language.as_deref().map(locale).unwrap_or("auto".into())],"model":opts.model,"features":{"enableAutomaticPunctuation":true}},"content":base64::Engine::encode(&base64::engine::general_purpose::STANDARD,&audio.wav)});
                let value = self
                    .value(
                        self.client
                            .post(format!(
                                "{}:recognize",
                                self.manifest.base_url.trim_end_matches('/')
                            ))
                            .json(&body),
                    )
                    .await?;
                let text = value["results"]
                    .as_array()
                    .ok_or_else(|| invalid("results"))?
                    .iter()
                    .filter_map(|r| {
                        r.pointer("/alternatives/0/transcript")
                            .and_then(Value::as_str)
                    })
                    .collect::<Vec<_>>()
                    .join(" ");
                transcript(&json!({"text":text,"segments":value["results"]}), "/text")
            }
            "gemini" => {
                let body = json!({"model":opts.model,"input":[{"type":"audio","data":base64::Engine::encode(&base64::engine::general_purpose::STANDARD,&audio.wav),"mime_type":"audio/wav"}],"generation_config":{"transcription_config":{"mode":{"type":"verbatim"}}}});
                let value = self
                    .value(self.client.post(self.at("/interactions")).json(&body))
                    .await?;
                let text = value["outputs"]
                    .as_array()
                    .ok_or_else(|| invalid("outputs"))?
                    .iter()
                    .filter_map(|o| o["text"].as_str())
                    .collect::<String>();
                transcript(&json!({"text":text}), "/text")
            }
            "aws" => {
                super::aws::transcribe(
                    &self.manifest.base_url,
                    self.api_key.as_deref(),
                    audio,
                    opts,
                )
                .await
            }
            _ => Err(TranscribeError::InvalidResponse(
                "This server protocol is not supported.".into(),
            )),
        }
    }
}

fn invalid(field: &str) -> TranscribeError {
    TranscribeError::InvalidResponse(format!("Missing {field} in the service response."))
}
fn field<'a>(v: &'a Value, name: &str) -> Result<&'a str, TranscribeError> {
    v[name].as_str().ok_or_else(|| invalid(name))
}
fn safe_id(v: &Value) -> Result<&str, TranscribeError> {
    let id = field(v, "id")?;
    if id.is_empty()
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(invalid("job identifier"));
    }
    Ok(id)
}
pub(super) fn transcript(v: &Value, path: &str) -> Result<Transcript, TranscribeError> {
    let text = v.pointer(path).and_then(Value::as_str).unwrap_or("").trim();
    if text.is_empty() {
        return Err(TranscribeError::InvalidResponse(
            "No speech was recognized. Try speaking closer to the microphone.".into(),
        ));
    }
    Ok(Transcript {
        text: text.into(),
        language: v["language"]
            .as_str()
            .or_else(|| v["language_code"].as_str())
            .map(str::to_owned),
        cost_usd: v.pointer("/usage/cost").and_then(Value::as_f64),
        segments: v["segments"]
            .as_array()
            .or_else(|| v["words"].as_array())
            .cloned()
            .unwrap_or_default(),
    })
}
pub fn locale(language: &str) -> String {
    if language.contains('-') {
        return language.into();
    }
    let suffix = match language {
        "en" => "US",
        "fr" => "FR",
        "de" => "DE",
        "es" => "ES",
        "pt" => "BR",
        "nl" => "NL",
        "it" => "IT",
        "ja" => "JP",
        "zh" => "CN",
        "hi" => "IN",
        "ko" => "KR",
        "ar" => "SA",
        "ru" => "RU",
        _ => return language.into(),
    };
    format!("{language}-{suffix}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{store::builtin_providers, transcribe::TranscriptionProvider};
    fn server(responses: Vec<Value>) -> (String, std::thread::JoinHandle<Vec<String>>) {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let endpoint = format!("http://{}", listener.local_addr().unwrap());
        let handle = std::thread::spawn(move || {
            responses.into_iter().map(|response| {
            let (mut socket,_) = listener.accept().unwrap();
            socket.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
            let mut raw=Vec::new(); let mut buf=[0;8192];
            loop { let n=socket.read(&mut buf).unwrap(); assert!(n>0); raw.extend_from_slice(&buf[..n]);
                if let Some(end)=raw.windows(4).position(|w|w==b"\r\n\r\n") {
                    let headers=String::from_utf8_lossy(&raw[..end]).to_ascii_lowercase();
                    let size=headers.lines().find_map(|line|line.strip_prefix("content-length: ").and_then(|n|n.parse::<usize>().ok())).unwrap_or(0);
                    if raw.len()>=end+4+size {break;}
                }
            }
            let body=response.to_string();
            write!(socket,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body).unwrap();
            String::from_utf8_lossy(&raw).into_owned()
        }).collect()
        });
        (endpoint, handle)
    }
    fn options(model: &str) -> TranscribeOpts {
        TranscribeOpts {
            model: model.into(),
            language: Some("fr".into()),
            biasing: vec!["Dictum".into()],
            zero_retention: true,
            cancellation: tokio_util::sync::CancellationToken::new(),
        }
    }
    #[tokio::test]
    async fn direct_vendor_requests_use_native_auth_audio_and_response_contracts() {
        let cases = [
            (
                "elevenlabs",
                json!({"text":"Bonjour"}),
                "xi-api-key: fixture-key",
                "name=\"model_id\"",
            ),
            (
                "deepgram",
                json!({"results":{"channels":[{"alternatives":[{"transcript":"Bonjour"}]}]}}),
                "authorization: Token fixture-key",
                "content-type: audio/wav",
            ),
            (
                "sarvam",
                json!({"transcript":"Bonjour"}),
                "api-subscription-key: fixture-key",
                "name=\"language_code\"",
            ),
            (
                "cartesia",
                json!({"text":"Bonjour"}),
                "x-api-key: fixture-key",
                "cartesia-version:",
            ),
            (
                "azure",
                json!({"combinedPhrases":[{"text":"Bonjour"}]}),
                "ocp-apim-subscription-key: fixture-key",
                "name=\"definition\"",
            ),
            (
                "googlecloud",
                json!({"results":[{"alternatives":[{"transcript":"Bonjour"}]}]}),
                "authorization: Bearer fixture-key",
                ":recognize HTTP",
            ),
            (
                "gemini",
                json!({"outputs":[{"type":"text","text":"Bonjour"}]}),
                "x-goog-api-key: fixture-key",
                "transcription_config",
            ),
            (
                "cohere",
                json!({"text":"Bonjour"}),
                "authorization: Bearer fixture-key",
                "name=\"file\"",
            ),
        ];
        for (id, response, auth, field) in cases {
            let (endpoint, server) = server(vec![response]);
            let mut manifest = builtin_providers()
                .into_iter()
                .find(|p| p.id == id)
                .unwrap();
            manifest.base_url = endpoint;
            if id == "googlecloud" {
                manifest.base_url.push_str("/recognizers/fixture");
            }
            let opts = options(&manifest.models[0]);
            let provider = HttpTranscriptionProvider::new(manifest, Some("fixture-key".into()));
            let result = provider
                .transcribe(
                    &AudioChunk {
                        wav: b"RIFF-fixture-audio".to_vec(),
                        duration_ms: 2000,
                    },
                    &opts,
                )
                .await
                .unwrap_or_else(|e| panic!("{id}: {e}"));
            assert_eq!(result.text, "Bonjour", "{id}");
            let requests = server.join().unwrap();
            assert!(requests[0].contains(auth), "{id}: missing auth");
            assert!(requests[0].contains(field), "{id}: missing field");
        }
    }
    #[tokio::test]
    async fn assembly_upload_create_poll_and_delete_own_job() {
        let (endpoint, server) = server(vec![
            json!({"upload_url":"https://fixture/upload"}),
            json!({"id":"own-job"}),
            json!({"status":"completed","text":"Bonjour"}),
            json!({}),
        ]);
        let mut manifest = builtin_providers()
            .into_iter()
            .find(|p| p.id == "assemblyai")
            .unwrap();
        manifest.base_url = endpoint;
        let opts = options(&manifest.models[0]);
        let provider = HttpTranscriptionProvider::new(manifest, Some("fixture-key".into()));
        let result = provider
            .transcribe(
                &AudioChunk {
                    wav: b"RIFF-audio".to_vec(),
                    duration_ms: 2000,
                },
                &opts,
            )
            .await
            .unwrap();
        assert_eq!(result.text, "Bonjour");
        let requests = tokio::task::spawn_blocking(move || server.join().unwrap())
            .await
            .unwrap();
        assert!(requests[0].starts_with("POST /upload "));
        assert!(requests[1].contains("\"speech_models\""));
        assert!(requests[1].contains("\"keyterms_prompt\":[\"Dictum\"]"));
        assert!(requests[2].starts_with("GET /transcript/own-job "));
        assert!(requests[3].starts_with("DELETE /transcript/own-job "));
    }
    #[test]
    fn parses_nested_transcripts_without_exposing_raw_responses() {
        let v = json!({"results":{"channels":[{"alternatives":[{"transcript":"Bonjour"}]}]}});
        assert_eq!(
            transcript(&v, "/results/channels/0/alternatives/0/transcript")
                .unwrap()
                .text,
            "Bonjour"
        );
        assert!(transcript(&v, "/text").is_err());
    }
    #[test]
    fn rejects_job_path_injection() {
        assert!(safe_id(&json!({"id":"../other-user"})).is_err());
        assert!(safe_id(&json!({"id":"job-123"})).is_ok());
    }
}
