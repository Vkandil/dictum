# Specification coverage

This document maps the acceptance contract in `dictum-spec.md` to implementation. “Implemented” means the source path exists and is exercised by compilation or a unit test; hardware-, credential-, and signing-dependent checks are completed by the platform smoke-test checklist below.

## P0 — end-to-end MVP

| Requirement | Status | Implementation |
|---|---:|---|
| Global hold, toggle, double-tap hotkeys; debounce; command key; Escape | Implemented | `src-tauri/src/hotkey.rs`, `commands.rs`, overlay keyboard handler |
| 16 kHz mono capture, RMS, VAD/trim, ≤30 s chunks, whisper gain | Implemented | `src-tauri/src/audio.rs` (29-second safety bound) |
| Provider abstraction and OpenRouter Voxtral default | Implemented | `src-tauri/src/transcribe/` |
| Clipboard-paste injection and keystroke fallback | Implemented | `src-tauri/src/inject.rs` |
| Non-focusable, transparent, always-on-top HUD | Implemented | `tauri.conf.json`, `src/routes/Overlay.tsx` |
| Tray pause/resume, direct Settings navigation, quit | Implemented | `src-tauri/src/lib.rs`, `src/App.tsx` |
| Provider/model/language/microphone/hotkey settings and key validation | Implemented | `src/routes/Settings.tsx`, `commands.rs` |
| API key in OS keychain, never config/SQLite | Implemented | `src-tauri/src/keychain.rs`; config contains no key field |
| First-run in-context microphone request, macOS permission links, and dictation sandbox | Implemented | `src/routes/Onboarding.tsx`, platform permission deep links, UI interaction tests |
| Toggleable launch at login | Implemented | Tauri autostart plugin |

## P1 — Wispr-style quality

| Requirement | Status | Implementation |
|---|---:|---|
| Optional filler, grammar, punctuation, self-correction, and fast insert/refine | Implemented | `src-tauri/src/format.rs`, `commands.rs` |
| Gmail/formal, Slack/casual, VS Code/code-aware app context | Implemented | `focus.rs`, deterministic tone inference and prompt |
| Personal dictionary and context bias | Implemented | SQLite dictionary; Mistral `context_bias`, generic `prompt`, formatter prompt |
| Learn from corrections | Implemented | History pencil action compares edited text and stores changed terms as `source=auto` |
| Voice snippets | Implemented | Exact cue expansion before formatting/insertion |
| Command mode on last inserted block | Implemented | Dedicated global shortcut and in-memory last block |
| Multilingual automatic detection and code-switching | Implemented | Omit language for auto; selectable ISO language hint |
| Whisper mode | Implemented | Gain plus peak normalization and lower VAD threshold |
| Text-only history, copy/delete/search, retention purge | Implemented | `store.rs`, `History.tsx`; no audio column or write path |
| Per-dictation and cumulative cost | Implemented | Provider `usage.cost`, duration/rate fallback, history summaries |

## P2 — beyond the baseline

| Requirement | Status | Implementation |
|---|---:|---|
| Local self-hosted vLLM backend | Implemented | OpenAI multipart provider at configurable loopback endpoint |
| Realtime streaming and live HUD text | Implemented | 16 kHz PCM bridge and WebSocket transport in `transcribe/realtime.rs`; batch fallback |
| Open provider/plugin system | Implemented | Validated data-only JSON manifests and Settings editor |
| Optional encrypted self-hosted sync | Implemented | Settings/dictionary/snippets envelope using Argon2 + AES-256-GCM and user endpoint |
| Scriptable CLI | Implemented | `dictum-cli transcribe file.wav` |
| Voice assistant answer insertion | Implemented | Say “ask Dictum …” or “answer …” in command mode; answer is inserted without requiring/replacing a previous block |

## Reliability, security, and packaging

- HTTP providers use 10-second timeouts, bounded exponential backoff for network/429/5xx errors, safe error messages, cancellation-by-new-session behavior, and compatible-model fallback providers.
- SQLite uses WAL, prepared statements, schema creation, a created-time index, and retention purge at startup and after inserts.
- The CSP allows only application resources and explicit provider/local endpoints. There are no remote fonts or telemetry dependencies.
- Provider identifiers and URL schemes are validated; provider plugins execute no code.
- CI formats, strictly lints, compiles, and tests frontend and Rust on macOS, Windows, and Ubuntu. Tagged releases import platform certificates, create native bundles, and sign updater artifacts. Release builds automatically check the signed update manifest.

## Automated verification evidence

- 24 Rust unit tests cover PCM conversion/WAV metadata, VAD boundaries, whisper normalization, chunk limits, app-aware prompts, snippets, assistant parsing, correction learning, cost rules, provider payload/privacy flags, error mapping, realtime dialects and the vLLM WebSocket handshake, SQLite privacy/CRUD/retention, provider validation, and encrypted sync.
- The CLI integration test generates a real WAV, sends multipart audio to a local mock provider, observes a 503 retry, then asserts the printed transcript.
- Five jsdom interaction/default tests cover private defaults, model/provider defaults, hosted-key gating, the local onboarding route, and the trial-dictation sandbox.
- `cargo clippy --all-targets -- -D warnings`, `cargo test --all-targets`, `npm test`, `npm run build`, and `npm audit` pass locally.
- The optimized Windows executable smoke-launches and stays responsive. MSI and NSIS bundles build successfully; their updater signatures match the public key embedded in `tauri.conf.json`. The NSIS bundle also passes a clean per-user install → installed-app launch → uninstall cycle. The MSI correctly requests elevation for its all-users install scope.
- Onboarding, dashboard, and the full Settings page were visually inspected at the target 1120×760 desktop viewport.

## Platform smoke-test checklist

Run before publishing a release on real hardware:

1. Fresh-install and complete onboarding without opening a config file.
2. Dictate into a native text field, browser Gmail/Notion, Slack, and VS Code.
3. Verify Unicode, emoji, multiline snippets, and preservation/restoration of text and image clipboards.
4. Deny and then grant microphone/accessibility/input-monitoring permissions; verify actionable HUD errors.
5. Unplug the selected microphone mid-recording and verify recovery.
6. Exercise hold, toggle, double-tap, command, cancellation, shortcut conflict, and tray pause.
7. Test a 31+ second utterance and confirm chunk concatenation.
8. Verify OpenRouter, Mistral, local vLLM, realtime, fallback, invalid key, quota, 429, timeout, and offline errors.
9. Confirm no audio files, API keys, or telemetry requests appear in application data/network inspection.
10. Install the signed bundle, update from the previous release, and verify launch-at-login.

Wayland synthetic input remains the explicit Linux risk accepted by section 16/17 of the spec; X11 is the v1 Linux target.
