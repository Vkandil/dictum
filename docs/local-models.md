# Local transcription and compatible servers

In **Settings → Transcription → On this computer**, download a model, wait for verification, then choose **Use this model**. No Python, Docker, account or terminal is needed. Dictation audio stays in memory. AI clean-up is a separate, optional connection; choosing a cloud clean-up service sends the transcript to that service.

The Windows package includes CPU inference engines, not model weights. The model cards show download size, estimated memory, supported languages and weight licence. Keep memory available for Windows and other applications as well as the displayed model estimate.

| Family | Installed runtime | Suitable use |
| --- | --- | --- |
| Whisper Tiny / Base / Small | whisper.cpp | Lighter multilingual CPU dictation; Small is the balanced starting option |
| Whisper Large v3 / Turbo / Turbo Q5 | whisper.cpp | Multilingual dictation on a machine with more memory; Q5 reduces weight size |
| Parakeet TDT 0.6B v3 INT8 | sherpa-onnx | European languages, including French |
| Qwen3-ASR 0.6B INT8 | sherpa-onnx | Multilingual alternative |
| Moonshine Tiny INT8 | sherpa-onnx | Lightweight English dictation |
| Nemotron 3.5 ASR streaming INT8 | sherpa-onnx | Local Live mode; choose it in the live settings |

The catalogue pins original URLs, byte sizes and SHA-256 hashes in [local-models.json](../src-tauri/catalog/local-models.json). Downloads can be paused and resumed. Installation happens after verification; removing a model frees its disk space. Models live beside the local SQLite database, in `models/`. The advanced import panel accepts the original catalogue `.bin` or `.tar.bz2` file and performs the same verification. It does not accept arbitrary GGUF, PyTorch or ONNX files.

CPU is the packaged default. Source builds can opt into `cuda` or `vulkan` for Whisper, with the matching SDK and drivers. Those builds need separate hardware validation; the normal installer does not promise GPU acceleration. `DICTUM_CPU_THREADS=1` through `8` can override the CPU thread count for diagnostics.

## Bring your own server

Use **Explore other options → My server** for a server you already run. The presets configure an address and model name; they do not install or launch the external server. Change the served model name to match your server.

| Server | Default address | Contract |
| --- | --- | --- |
| [Speaches](https://github.com/speaches-ai/speaches) | `http://localhost:8000/v1` | OpenAI multipart `/audio/transcriptions` |
| [whisper.cpp server](https://github.com/ggml-org/whisper.cpp/tree/master/examples/server) | `http://localhost:8080` | Multipart `/inference` |
| [LocalAI](https://localai.io/features/audio-to-text/) | `http://localhost:8080/v1` | OpenAI multipart `/audio/transcriptions` |
| [vLLM](https://docs.vllm.ai/en/latest/features/multimodal_inputs.html) | `http://localhost:8000/v1` | OpenAI transcription, when supported by the installed model/runtime |

Voxtral, Qwen3-ASR 1.7B, Canary, Cohere Transcribe, IBM Granite Speech and SenseVoice can use this path when their runtime exposes a supported contract. A weight file alone does not expose an API. Check the runtime's supported models, languages, operating system and licence; Ollama's text endpoints are not automatically audio transcription endpoints.

For a server on another computer, set its real address. Dictum describes only native inference and loopback endpoints as processing on this computer. A cloud backup for local dictation requires a separate explicit opt-in. If you enable AI clean-up on a local server, that server must also serve the selected text model through `/chat/completions`.

## CLI

```powershell
dictum-cli.exe models list
dictum-cli.exe models download whisper-small
dictum-cli.exe models import whisper-small C:\Models\ggml-small.bin
dictum-cli.exe transcribe recording.wav --provider offline --model whisper-small --language fr
dictum-cli.exe transcribe recording.wav --provider offline --model nemotron-streaming --language fr
dictum-cli.exe models remove whisper-small
```

The input must be 16 kHz mono PCM16 WAV. Local streaming models are automatically routed through their streaming engine by the CLI. `DICTUM_DATA_DIR` can select an isolated data directory for development and tests.
