# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through [GitHub Security Advisories](https://github.com/Vkandil/dictum/security/advisories/new) rather than a public issue. Include the affected Dictum version, your Windows version/build, the impact, and reproduction steps.

Security fixes target the latest stable release. Older releases may be asked to update before a report is investigated.

## What Dictum does with your data

| Data | Where it lives | Leaves your machine? |
| --- | --- | --- |
| Microphone audio | Memory only, discarded after transcription | Sent to the transcription service you configured — never to us, never to disk |
| API keys | Windows Credential Manager | No. The app only ever reads them to authenticate your own requests |
| Transcript history | Local SQLite database, optional and time-limited | No |
| Dictionary and snippets | Local SQLite database | Only if *you* enable encrypted sync to a server you control |
| Usage analytics | Does not exist | There is no telemetry, no crash reporting, and no analytics of any kind |

Audio is never written to disk. `history.storeAudio` is rejected by settings validation, so it cannot be turned on by editing the config file either.

## Trust boundaries

- **API keys** are stored only through the OS credential service, never in the config file or the database. The UI receives at most a masked preview (last four characters).
- **Provider manifests are data, not code.** Adding a provider cannot execute anything: ids are restricted to `[A-Za-z0-9_-]`, URLs must be HTTP(S), and paths must be absolute and free of `..`.
- **All network traffic originates in the Rust backend.** The webview makes no outbound requests, so its Content-Security-Policy denies every external origin.
- **Plain HTTP** is accepted only for loopback addresses, for local model servers. Everything else must be HTTPS.
- **Sync payloads** are encrypted on-device with AES-256-GCM using an Argon2id-derived key, with a fresh random salt and nonce per upload. The passphrase never leaves your machine and is separate from any server login, so the endpoint operator cannot decrypt what you store there.
- **Sync responses** are read with a timeout and a size ceiling, so a hostile or broken endpoint cannot hang the app or exhaust memory.

## Supply chain

- Every push and pull request runs `cargo clippy -D warnings`, `cargo fmt --check`, both test suites, `cargo audit`, and `npm audit`.
- Dependabot proposes weekly dependency updates.
- Release installers are built from a clean checkout by GitHub Actions, and SHA-256 checksums are published alongside them so you can verify what you downloaded.

## Known limitations

- **Installers are not code-signed.** Windows SmartScreen will warn you on first run. Verify the SHA-256 checksum against `SHA256SUMS.txt` on the release page if you want assurance the download is intact.
- **Your transcription provider sees your audio.** That is inherent to using a hosted service. For a fully offline setup, point Dictum at a local server; audio then never leaves your machine.
- **Local history is not encrypted at rest.** It is protected by your Windows user account, like other application data. Disable history, or shorten its retention, if that is not sufficient for your threat model.
