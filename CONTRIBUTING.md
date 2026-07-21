# Contributing to Dictum

Thank you for helping make private Windows voice dictation accessible. Dictum 1.x supports 64-bit Windows 10 and Windows 11 only. Open an issue before large architectural changes. Small fixes can go directly to a pull request.

1. Install the prerequisites listed in `README.md`.
2. Develop and test on Windows using `npm ci` and `npm run desktop:dev`.
3. Keep provider code behind `TranscriptionProvider`; never couple capture or injection to a vendor.
4. Do not add telemetry, persist raw audio, log secrets, or put credentials in fixtures.
5. Add tests for non-trivial audio, storage, prompt, parsing, or privacy logic.
6. Run every command in the README's validation section, including the 75-second audio regression.

By contributing, you agree to license your contribution under MIT.
