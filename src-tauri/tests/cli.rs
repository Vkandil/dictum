use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    process::Command,
    thread,
};

fn read_request(stream: &mut TcpStream) -> Vec<u8> {
    let mut request = Vec::new();
    let mut buffer = [0_u8; 4096];
    loop {
        let read = stream.read(&mut buffer).unwrap();
        if read == 0 {
            break;
        }
        request.extend_from_slice(&buffer[..read]);
        let Some(header_end) = request.windows(4).position(|window| window == b"\r\n\r\n") else {
            continue;
        };
        let headers = String::from_utf8_lossy(&request[..header_end]);
        let content_length = headers
            .lines()
            .find_map(|line| {
                line.to_ascii_lowercase()
                    .strip_prefix("content-length: ")
                    .map(str::to_owned)
            })
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(0);
        if request.len() >= header_end + 4 + content_length {
            break;
        }
    }
    request
}

#[test]
fn cli_transcribes_a_wav_through_a_local_provider_and_retries_5xx() {
    let directory = std::env::temp_dir().join(format!("dictum-cli-test-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&directory).unwrap();
    let wav_path = directory.join("sample.wav");
    let mut writer = hound::WavWriter::create(
        &wav_path,
        hound::WavSpec {
            channels: 1,
            sample_rate: 16_000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        },
    )
    .unwrap();
    writer.write_sample::<i16>(100).unwrap();
    writer.finalize().unwrap();

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let server = thread::spawn(move || {
        for attempt in 0..2 {
            let (mut stream, _) = listener.accept().unwrap();
            let request = read_request(&mut stream);
            let raw = String::from_utf8_lossy(&request);
            assert!(raw.starts_with("POST /v1/audio/transcriptions HTTP/1.1"));
            assert!(raw.contains("name=\"model\""));
            assert!(raw.contains("test-voxtral"));
            assert!(raw.contains("name=\"file\""));
            let (status, body) = if attempt == 0 {
                (
                    "503 Service Unavailable",
                    r#"{"error":{"message":"warming up"}}"#,
                )
            } else {
                (
                    "200 OK",
                    r#"{"text":"mock transcript","language":"en","usage":{"cost":0.0}}"#,
                )
            };
            write!(
                stream,
                "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            )
            .unwrap();
        }
    });

    let endpoint = format!("http://{address}/v1");
    let output = Command::new(env!("CARGO_BIN_EXE_dictum-cli"))
        .env("DICTUM_DATA_DIR", &directory)
        .args([
            "transcribe",
            wav_path.to_str().unwrap(),
            "--provider",
            "local",
            "--model",
            "test-voxtral",
            "--endpoint",
            &endpoint,
        ])
        .output()
        .unwrap();
    server.join().unwrap();

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(
        String::from_utf8_lossy(&output.stdout).trim(),
        "mock transcript"
    );
    std::fs::remove_dir_all(directory).unwrap();
}
