# Dictum

Dictum is an open-source, system-wide voice-dictation desktop app. Hold a shortcut, speak naturally, and polished text is inserted wherever your cursor is. It is local-first, has no telemetry, stores keys in the operating-system keychain, and works with OpenRouter, Mistral, local vLLM, or an OpenAI-compatible provider plugin.

> Project status: source-complete v0.1.0. Builds are automated for macOS, Windows, and Linux. Public releases still require the repository owner’s platform signing credentials.

## What works

- Hold-to-talk, toggle, and double-tap right Shift global shortcuts
- 16 kHz mono capture, live level meter, silence trimming, whisper gain, and safe ≤29-second chunks
- OpenRouter/Voxtral Mini default, Mistral native, local vLLM, fallback providers, and custom provider manifests
- Optional live realtime transcription and automatic batch fallback
- Optional LLM polish, self-correction resolution, app-aware tone, command mode, and “ask Dictum” assistant commands
- Unicode-safe clipboard insertion with clipboard restoration and synthetic-keystroke fallback
- OS-keychain credentials, SQLite history, actual/estimated costs, retention purge, dictionary learning, and voice snippets
- Encrypted opt-in sync to a user-owned HTTP/WebDAV target
- Transparent non-focusable HUD, tray pause/resume, first-run permissions, and launch-at-login
- `dictum-cli transcribe recording.wav` for scripts

The complete product contract is [dictum-spec.md](dictum-spec.md); implementation coverage is tracked in [docs/spec-coverage.md](docs/spec-coverage.md).

## Build locally

Prerequisites:

- Node.js 20+
- Rust 1.81+
- The platform prerequisites from the [Tauri v2 guide](https://v2.tauri.app/start/prerequisites/)

```sh
npm install
npm run build
npm run desktop:dev
```

Run checks:

```sh
npm test
npm run build
cd src-tauri && cargo test --all-targets
```

Keys are entered in the UI. They are stored under service `com.dictum.app`, account `<provider>`, using Keychain on macOS, Credential Manager on Windows, or Secret Service on Linux. They never enter SQLite or `config.json`.

## Local/offline mode

Install vLLM with audio support, then serve a supported transcription model:

```sh
pip install 'vllm[audio]'
vllm serve mistralai/Voxtral-Mini-3B-2507 --port 8000
```

Choose **Local / vLLM** in Settings and leave the default endpoint at `http://localhost:8000/v1`. Exact supported checkpoints depend on the installed vLLM release; see the [vLLM transcription documentation](https://docs.vllm.ai/en/stable/serving/openai_compatible_server/#transcriptions-api).

For local realtime, serve `mistralai/Voxtral-Mini-4B-Realtime-2602`, enable Realtime in Settings, and point a provider manifest at the server.

## CLI

The desktop build includes a separate scriptable binary:

```sh
dictum-cli transcribe recording.wav
dictum-cli transcribe recording.wav --provider local --model mistralai/Voxtral-Mini-3B-2507 --endpoint http://localhost:8000/v1
dictum-cli config-path
```

The CLI reads the same non-secret settings and keychain credentials. `OPENROUTER_API_KEY` or `MISTRAL_API_KEY` can override the keychain for ephemeral CI use.

## Provider plugins

Provider plugins are data-only manifests, so adding an OpenAI-compatible transcription service does not execute third-party code. Add one in Settings or put a JSON manifest matching [examples/providers/deepgram-compatible.json](examples/providers/deepgram-compatible.json) in the platform config directory’s `providers/` folder.

## Privacy and platform notes

Dictum has no analytics SDK, remote fonts, crash reporter, or telemetry endpoint. Audio is held in memory and never written to disk. In cloud mode only audio, selected language, model, and dictionary bias terms go to the chosen provider. Text history is local and optional.

- macOS requires Microphone and Accessibility permissions. Double-tap also needs Input Monitoring.
- Windows uses `SendInput` through Enigo and needs microphone permission.
- Linux X11 is supported best-effort. Wayland intentionally blocks synthetic global input; `ydotool`, `wtype`, or a future input portal is required and remains a documented platform limitation.

## Release signing

The release workflow builds `.dmg`, `.msi`/NSIS, `.AppImage`, and `.deb` artifacts. Maintainers must configure Apple notarization, Windows certificate, and Tauri updater signing secrets described in [docs/releasing.md](docs/releasing.md). Unsigned local builds work with `npm run desktop:build`.

## Credits and license

Dictum is powered by the open Voxtral model family from [Mistral AI](https://mistral.ai/) and uses [OpenRouter](https://openrouter.ai/) as its default hosted gateway. Application source is [MIT licensed](LICENSE); Voxtral weights retain their own Apache-2.0 terms.
