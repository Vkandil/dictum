//! Opt-in ABI/inference regression test; normal CI never downloads model weights.
use dictum_lib::{
    audio::AudioChunk,
    store::builtin_providers,
    transcribe::{
        create_provider, native,
        realtime::{RealtimeDialect, RealtimeEvent, RealtimeSession},
        TranscribeOpts,
    },
};
use std::{path::PathBuf, time::Duration};
use tokio_util::sync::CancellationToken;

#[tokio::test]
#[ignore = "requires DICTUM_SMOKE_MODELS and DICTUM_SMOKE_WAV with pinned models and the public JFK fixture"]
async fn native_batch_engines_and_preloaded_streaming_engine_transcribe_real_audio() {
    let root = PathBuf::from(std::env::var_os("DICTUM_SMOKE_MODELS").expect("model directory"));
    let bytes =
        std::fs::read(std::env::var_os("DICTUM_SMOKE_WAV").expect("public JFK WAV fixture"))
            .unwrap();
    let provider = builtin_providers()
        .into_iter()
        .find(|p| p.id == "offline")
        .unwrap();
    for id in [
        "whisper-tiny",
        "moonshine-tiny",
        "parakeet-v3",
        "qwen3-asr-0.6b",
    ] {
        let opts = TranscribeOpts {
            model: id.into(),
            language: Some("en".into()),
            biasing: Vec::new(),
            zero_retention: true,
            cancellation: CancellationToken::new(),
        };
        native::prepare(root.clone(), id.into()).await.unwrap();
        let service = create_provider(provider.clone(), None, None, root.clone());
        let result = tokio::time::timeout(
            Duration::from_secs(60),
            service.transcribe(
                &AudioChunk {
                    wav: bytes.clone(),
                    duration_ms: 11000,
                },
                &opts,
            ),
        )
        .await
        .expect("native inference must finish")
        .unwrap();
        assert!(
            result.text.to_lowercase().contains("country"),
            "{id} recognized the reference speech"
        );
        assert_eq!(result.cost_usd, Some(0.0));
        if id == "whisper-tiny" {
            let cancelled = TranscribeOpts {
                cancellation: CancellationToken::new(),
                ..opts.clone()
            };
            let token = cancelled.cancellation.clone();
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_millis(10)).await;
                token.cancel();
            });
            let audio = AudioChunk {
                wav: bytes.clone(),
                duration_ms: 11000,
            };
            let result = tokio::time::timeout(
                Duration::from_secs(5),
                service.transcribe(&audio, &cancelled),
            )
            .await
            .unwrap();
            assert!(matches!(
                result,
                Err(dictum_lib::transcribe::TranscribeError::Cancelled)
            ));
            // Ensures the C abort callback also released the inference worker.
            tokio::time::timeout(
                Duration::from_secs(5),
                native::prepare(root.clone(), id.into()),
            )
            .await
            .unwrap()
            .unwrap();
        }
    }
    native::prepare(root.clone(), "nemotron-streaming".into())
        .await
        .unwrap();
    let opts = TranscribeOpts {
        model: "nemotron-streaming".into(),
        language: Some("en".into()),
        biasing: Vec::new(),
        zero_retention: true,
        cancellation: CancellationToken::new(),
    };
    let mut live = RealtimeSession::connect_extended(
        "",
        &opts.model,
        None,
        RealtimeDialect::Native,
        &opts,
        &root,
    )
    .await
    .unwrap();
    let audio: Vec<i16> = native::decode_wav(&bytes)
        .unwrap()
        .into_iter()
        .map(|s| (s * 32768.0) as i16)
        .collect();
    let tx = live.sender();
    let sender = tokio::spawn(async move {
        for frame in audio.chunks(1600) {
            tx.send(frame.to_vec()).await.unwrap();
        }
        tx.send(Vec::new()).await.unwrap();
    });
    let text = tokio::time::timeout(Duration::from_secs(60), async {
        while let Some(event) = live.events.recv().await {
            match event {
                RealtimeEvent::Final(text) => return text,
                RealtimeEvent::Error(e) => panic!("{e}"),
                _ => {}
            }
        }
        panic!("streaming must produce a final transcript")
    })
    .await
    .unwrap();
    sender.await.unwrap();
    assert!(text.to_lowercase().contains("country"));
}
