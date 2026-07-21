# Contributing to Utter

Thank you for helping make private voice dictation accessible. Open an issue before large architectural changes. Small fixes can go directly to a pull request.

1. Install the prerequisites listed in `README.md`.
2. Run `npm install` and `npm run desktop:dev`.
3. Keep provider code behind `TranscriptionProvider`; never couple capture or injection to a vendor.
4. Do not add telemetry, persist raw audio, log secrets, or put credentials in fixtures.
5. Add tests for non-trivial audio, storage, prompt, parsing, or privacy logic.
6. Run `npm run build`, `npm test`, `cargo fmt --check`, and `cargo test --all-targets`.

By contributing, you agree to license your contribution under MIT.
