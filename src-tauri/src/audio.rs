use std::io::Cursor;
use std::sync::{mpsc, Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::{bail, Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::SampleFormat;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

const TARGET_RATE: u32 = 16_000;
const MAX_CHUNK_SECONDS: usize = 29;

#[derive(Debug, Clone)]
pub struct AudioChunk {
    pub wav: Vec<u8>,
    pub duration_ms: u64,
}

pub struct AudioCapture {
    pub chunks: Vec<AudioChunk>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

struct ActiveRecording {
    stop: mpsc::Sender<()>,
    samples: Arc<Mutex<Vec<f32>>>,
    sample_rate: u32,
    channels: usize,
    started: Instant,
    whisper_mode: bool,
}

#[derive(Clone)]
struct LiveCapture {
    samples: Arc<Mutex<Vec<f32>>>,
    app: AppHandle,
    last_level: Arc<Mutex<Instant>>,
    channels: usize,
    sample_rate: u32,
    realtime: Option<tokio::sync::mpsc::Sender<Vec<i16>>>,
}

#[derive(Default)]
pub struct AudioRecorder {
    active: Mutex<Option<ActiveRecording>>,
}

impl AudioRecorder {
    pub fn devices() -> Result<Vec<AudioDevice>> {
        let host = cpal::default_host();
        let default_name = host.default_input_device().and_then(|d| d.name().ok());
        let mut devices = Vec::new();
        for (index, device) in host.input_devices()?.enumerate() {
            let name = device
                .name()
                .unwrap_or_else(|_| format!("Microphone {}", index + 1));
            devices.push(AudioDevice {
                id: name.clone(),
                is_default: default_name.as_deref() == Some(&name),
                name,
            });
        }
        Ok(devices)
    }

    pub fn start(
        &self,
        app: AppHandle,
        device_id: Option<&str>,
        whisper_mode: bool,
        live_tx: Option<tokio::sync::mpsc::Sender<Vec<i16>>>,
    ) -> Result<()> {
        let mut guard = self.active.lock().unwrap();
        if guard.is_some() {
            return Ok(());
        }
        let host = cpal::default_host();
        let device = match device_id {
            Some(id) => host
                .input_devices()?
                .find(|device| device.name().ok().as_deref() == Some(id))
                .context("selected microphone is unavailable")?,
            None => host
                .default_input_device()
                .context("no microphone is available")?,
        };
        let supported = device
            .default_input_config()
            .context("could not read microphone configuration")?;
        let sample_rate = supported.sample_rate().0;
        let channels = supported.channels() as usize;
        let config = supported.config();
        let samples = Arc::new(Mutex::new(Vec::<f32>::with_capacity(
            sample_rate as usize * channels * 30,
        )));
        let format = supported.sample_format();
        if !matches!(
            format,
            SampleFormat::F32 | SampleFormat::I16 | SampleFormat::U16
        ) {
            bail!("unsupported microphone sample format: {format:?}");
        }
        let thread_samples = samples.clone();
        let (stop_tx, stop_rx) = mpsc::channel();
        let (ready_tx, ready_rx) = mpsc::sync_channel(1);
        std::thread::spawn(move || {
            let live = LiveCapture {
                samples: thread_samples,
                app,
                last_level: Arc::new(Mutex::new(Instant::now())),
                channels,
                sample_rate,
                realtime: live_tx,
            };
            let result = match format {
                SampleFormat::F32 => build_f32_stream(&device, &config, live),
                SampleFormat::I16 => build_i16_stream(&device, &config, live),
                SampleFormat::U16 => build_u16_stream(&device, &config, live),
                _ => unreachable!(),
            };
            match result {
                Ok(stream) => {
                    if stream.play().is_ok() {
                        let _ = ready_tx.send(Ok(()));
                        let _ = stop_rx.recv();
                    } else {
                        let _ = ready_tx.send(Err("microphone stream could not start".into()));
                    }
                }
                Err(error) => {
                    let _ = ready_tx.send(Err(error.to_string()));
                }
            }
        });
        ready_rx
            .recv_timeout(Duration::from_secs(4))
            .context("microphone did not start")?
            .map_err(anyhow::Error::msg)?;
        *guard = Some(ActiveRecording {
            stop: stop_tx,
            samples,
            sample_rate,
            channels,
            started: Instant::now(),
            whisper_mode,
        });
        Ok(())
    }

    pub fn stop(&self) -> Result<AudioCapture> {
        let recording = self
            .active
            .lock()
            .unwrap()
            .take()
            .context("recording is not active")?;
        let _ = recording.stop.send(());
        let elapsed_ms = recording.started.elapsed().as_millis() as u64;
        let samples = recording.samples.lock().unwrap().clone();
        let mono = downmix(&samples, recording.channels);
        let mut normalized = resample_linear(&mono, recording.sample_rate, TARGET_RATE);
        if recording.whisper_mode {
            apply_gain_and_normalize(&mut normalized, 3.0);
        }
        let threshold = if recording.whisper_mode {
            0.0025
        } else {
            0.006
        };
        let trimmed = trim_silence(&normalized, TARGET_RATE, threshold);
        if trimmed.len() < (TARGET_RATE as usize / 8) {
            bail!("no speech detected");
        }
        let mut chunks = Vec::new();
        for samples in trimmed.chunks(TARGET_RATE as usize * MAX_CHUNK_SECONDS) {
            chunks.push(AudioChunk {
                wav: encode_wav(samples)?,
                duration_ms: (samples.len() as u64 * 1000) / TARGET_RATE as u64,
            });
        }
        Ok(AudioCapture {
            chunks,
            duration_ms: elapsed_ms,
        })
    }

    pub fn cancel(&self) {
        self.active.lock().unwrap().take();
    }
    pub fn is_active(&self) -> bool {
        self.active.lock().unwrap().is_some()
    }
}

fn report_level<T>(data: &[T], convert: impl Fn(&T) -> f32, capture: &LiveCapture) {
    let values: Vec<f32> = data.iter().map(convert).collect();
    let peak = values.iter().map(|sample| sample * sample).sum::<f32>();
    if let Ok(mut buffer) = capture.samples.lock() {
        buffer.extend_from_slice(&values);
    }
    if let Some(tx) = &capture.realtime {
        let mono = downmix(&values, capture.channels);
        let live = resample_linear(&mono, capture.sample_rate, TARGET_RATE)
            .into_iter()
            .map(|v| (v.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
            .collect();
        let _ = tx.try_send(live);
    }
    if let Ok(mut last) = capture.last_level.lock() {
        if last.elapsed() >= Duration::from_millis(45) {
            let level = if values.is_empty() {
                0.0
            } else {
                (peak / values.len() as f32).sqrt().min(1.0)
            };
            let _ = capture.app.emit(
                "dictation:state",
                serde_json::json!({"phase":"listening","level":level}),
            );
            *last = Instant::now();
        }
    }
}

fn build_f32_stream(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    capture: LiveCapture,
) -> Result<cpal::Stream> {
    let error_app = capture.app.clone();
    Ok(device.build_input_stream(config, move |data: &[f32], _| report_level(data, |v| *v, &capture), move |error| { let _ = error_app.emit("dictation:state", serde_json::json!({"phase":"error","errorCode":"microphone_disconnected","message":error.to_string()})); }, None)?)
}
fn build_i16_stream(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    capture: LiveCapture,
) -> Result<cpal::Stream> {
    let error_app = capture.app.clone();
    Ok(device.build_input_stream(config, move |data: &[i16], _| report_level(data, |v| *v as f32 / i16::MAX as f32, &capture), move |error| { let _ = error_app.emit("dictation:state", serde_json::json!({"phase":"error","errorCode":"microphone_disconnected","message":error.to_string()})); }, None)?)
}
fn build_u16_stream(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    capture: LiveCapture,
) -> Result<cpal::Stream> {
    let error_app = capture.app.clone();
    Ok(device.build_input_stream(config, move |data: &[u16], _| report_level(data, |v| (*v as f32 / u16::MAX as f32) * 2.0 - 1.0, &capture), move |error| { let _ = error_app.emit("dictation:state", serde_json::json!({"phase":"error","errorCode":"microphone_disconnected","message":error.to_string()})); }, None)?)
}

fn downmix(samples: &[f32], channels: usize) -> Vec<f32> {
    if channels <= 1 {
        return samples.to_vec();
    }
    samples
        .chunks(channels)
        .map(|frame| frame.iter().sum::<f32>() / frame.len() as f32)
        .collect()
}

fn resample_linear(input: &[f32], from: u32, to: u32) -> Vec<f32> {
    if from == to {
        return input.to_vec();
    }
    let output_len = (input.len() as u64 * to as u64 / from as u64) as usize;
    let ratio = from as f64 / to as f64;
    (0..output_len)
        .map(|index| {
            let pos = index as f64 * ratio;
            let left = pos.floor() as usize;
            let right = (left + 1).min(input.len().saturating_sub(1));
            let fraction = (pos - left as f64) as f32;
            input.get(left).copied().unwrap_or(0.0) * (1.0 - fraction)
                + input.get(right).copied().unwrap_or(0.0) * fraction
        })
        .collect()
}

fn apply_gain_and_normalize(samples: &mut [f32], gain: f32) {
    for sample in samples.iter_mut() {
        *sample *= gain;
    }
    let peak = samples
        .iter()
        .fold(0.0_f32, |value, sample| value.max(sample.abs()));
    if peak > 0.0 {
        let scale = (0.92 / peak).min(1.0);
        for sample in samples {
            *sample *= scale;
        }
    }
}

fn trim_silence(samples: &[f32], sample_rate: u32, threshold: f32) -> &[f32] {
    let frame = (sample_rate as usize / 50).max(1); // 20 ms
    let voiced: Vec<bool> = samples
        .chunks(frame)
        .map(|chunk| {
            (chunk.iter().map(|s| s * s).sum::<f32>() / chunk.len() as f32).sqrt() >= threshold
        })
        .collect();
    let first = voiced.iter().position(|v| *v).unwrap_or(voiced.len());
    let last = voiced
        .iter()
        .rposition(|v| *v)
        .map(|i| i + 1)
        .unwrap_or(first);
    let padding = sample_rate as usize / 5;
    let start = first.saturating_mul(frame).saturating_sub(padding);
    let end = (last.saturating_mul(frame) + padding).min(samples.len());
    &samples[start.min(end)..end]
}

fn encode_wav(samples: &[f32]) -> Result<Vec<u8>> {
    let mut cursor = Cursor::new(Vec::new());
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: TARGET_RATE,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::new(&mut cursor, spec)?;
    for sample in samples {
        writer.write_sample((sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)?;
    }
    writer.finalize()?;
    Ok(cursor.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn trims_edges_but_keeps_voice() {
        let mut data = vec![0.0; 16000];
        data.extend(vec![0.1; 16000]);
        data.extend(vec![0.0; 16000]);
        let result = trim_silence(&data, 16000, 0.01);
        assert!(result.len() >= 16000);
        assert!(result.len() < data.len());
    }
    #[test]
    fn chunks_never_exceed_encoder_limit() {
        let data = vec![0.1; TARGET_RATE as usize * 31];
        let chunks: Vec<_> = data
            .chunks(TARGET_RATE as usize * MAX_CHUNK_SECONDS)
            .collect();
        assert!(chunks.iter().all(|c| c.len() <= TARGET_RATE as usize * 29));
    }

    #[test]
    fn downmixes_stereo_and_resamples_to_sixteen_kilohertz() {
        let stereo = vec![1.0, -1.0, 0.5, 0.5, -0.5, 0.5, 0.25, 0.75];
        let mono = downmix(&stereo, 2);
        assert_eq!(mono, vec![0.0, 0.5, 0.0, 0.5]);
        let resampled = resample_linear(&mono, 32_000, TARGET_RATE);
        assert_eq!(resampled.len(), 2);
    }

    #[test]
    fn wav_output_is_pcm16_mono_at_sixteen_kilohertz() {
        let bytes = encode_wav(&[0.0, 0.5, -0.5]).unwrap();
        let reader = hound::WavReader::new(Cursor::new(bytes)).unwrap();
        let spec = reader.spec();
        assert_eq!(spec.channels, 1);
        assert_eq!(spec.sample_rate, TARGET_RATE);
        assert_eq!(spec.bits_per_sample, 16);
        assert_eq!(spec.sample_format, hound::SampleFormat::Int);
        assert_eq!(reader.duration(), 3);
    }

    #[test]
    fn whisper_gain_normalizes_without_clipping() {
        let mut samples = vec![0.05, -0.1, 0.2];
        apply_gain_and_normalize(&mut samples, 3.0);
        let peak = samples
            .iter()
            .map(|sample| sample.abs())
            .fold(0.0_f32, f32::max);
        assert!(peak <= 0.92);
        assert!(peak > 0.2);
    }
}
