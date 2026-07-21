# Dictum 1.0 Windows release checklist

Dictum 1.0 supports 64-bit Windows 10 and Windows 11. This checklist is the release acceptance contract for the public Windows build.

## Automated gates

Every pull request and `main` push must pass the Windows CI workflow:

- `npm ci`
- `npm run build`
- `npm test`
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml --all-targets`

The Rust suite covers audio conversion, silence trimming, whisper normalization, chunk boundaries, a 75-second full-retention recording, provider payloads and error mapping, realtime transport, formatting, snippets, dictionary learning, storage privacy, encrypted sync, and the CLI provider retry path.

## Windows product acceptance

- [x] Windows is the only build target in Cargo, Tauri, Vite, CI, and release automation.
- [x] The application version is `1.0.0` in npm, Cargo, Tauri, and both lockfiles.
- [x] The NSIS and MSI targets are the only configured application bundles.
- [x] API keys use Windows Credential Manager and never enter SQLite or `config.json`.
- [x] Microphone access opens the Windows Privacy settings page when needed.
- [x] Global hold, toggle, double-tap, command, and Escape-cancel behavior is implemented.
- [x] Clipboard insertion uses `Ctrl+V`, restores text/image clipboard content, and falls back to Unicode typing.
- [x] Recordings are captured to memory, converted to 16 kHz mono, and split into complete 25-second WAV parts.
- [x] Provider calls allow 90 seconds per part and report `Transcribing part X of Y` for long recordings.
- [x] Text history is optional and raw audio persistence is rejected by backend validation.
- [x] The updater is restricted to signed Windows release artifacts.

## Manual smoke test before publishing

Run these checks on a clean Windows 10 or Windows 11 user profile:

1. Install the signed NSIS package and launch Dictum from the Start menu.
2. Complete onboarding using an OpenRouter key with available credits.
3. Select and test the intended microphone; deny and then grant desktop microphone permission once.
4. Record and transcribe a short sentence from the onboarding test page.
5. Use hold-to-talk, toggle, and double-tap modes in Notepad, a browser text field, and a code editor.
6. Record continuous speech for at least 75 seconds. Confirm all parts are reported, combined in order, and inserted.
7. Verify a 75-second dictation with a pause around the 25- and 50-second boundaries.
8. Cancel a recording with Escape and confirm that nothing is inserted.
9. Exercise command mode on the previous Dictum insertion.
10. Confirm Unicode, accented characters, emoji, multiline snippets, and clipboard restoration.
11. Test invalid-key, insufficient-credit, offline, timeout, and shortcut-conflict messages.
12. Close to tray, pause/resume, enable launch at login, and restart Windows.
13. Confirm History retention/deletion, Dictionary, Snippets, provider fallback, and encrypted sync.
14. Install the MSI package in a disposable VM and verify uninstall removes the application.
15. Update from the previous signed Dictum version and confirm the updater signature is accepted.

## Release artifacts

A complete GitHub release contains:

- Signed NSIS `.exe`
- Signed `.msi`
- Signed `latest.json` updater manifest and signatures
- Release notes describing user-visible changes
- SHA-256 checksums for the installers

