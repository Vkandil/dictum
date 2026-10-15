# Privacy policy

Last updated: 15 October 2026. This page describes the current Dictum source code. Features available in an installed release can differ; release notes identify the changes.

Dictum is a Windows desktop application maintained at [Vkandil/dictum](https://github.com/Vkandil/dictum). The project does not operate a transcription backend, collect usage analytics, or receive your recordings through a Dictum-hosted service. There is no advertising SDK, analytics SDK, telemetry endpoint, or crash-reporting service in the application.

## Audio and text

Dictum captures microphone audio when you start a recording. It processes that audio in memory and does not persist raw microphone recordings to disk. The CLI reads the audio file you explicitly supply; that original file remains under your control.

With a native on-device model, transcription runs on your computer. With a hosted transcription provider, Dictum sends audio and relevant request context, such as the selected language and supported dictionary hints, to the service you configure. A server you configure receives the same kinds of request data and may run locally or remotely.

Optional AI cleanup and command features send text and relevant context to the separately configured formatting provider. Depending on the operation, this can include the transcript or expanded snippet text, the previous Dictum insertion, your instruction, dictionary terms, and the focused window title used as application context. A window title can contain document or website names. A local transcription model alone does not make a separately enabled cloud formatting service local. Local-to-cloud recovery requires the corresponding consent setting.

Provider credentials are stored using Windows Credential Manager. Dictum reads them to authenticate requests to the configured service; it does not put them in the local settings database. The credential needed for a request is transmitted to its configured endpoint. Check custom endpoints before supplying a credential.

## Local storage and your controls

Settings, dictionary terms, snippets and optional text history are stored on your computer. Text history has configurable retention and can be disabled or deleted in the application. The local database is not encrypted at rest by Dictum. Downloaded model files are stored locally and can be removed through model management. Uninstalling the program does not necessarily remove its user data.

Optional sync sends an encrypted document containing settings, dictionary terms and snippets to your configured sync endpoint. This export does not include transcript history, raw recordings or credentials stored in Windows Credential Manager. Encryption takes place on your computer using a key derived from your sync passphrase. The endpoint still receives ordinary connection metadata.

## Other network connections

- Production builds automatically check GitHub for updates and can download and install an available update. GitHub and its delivery infrastructure receive ordinary network metadata, such as your IP address and request headers. Recordings and transcripts are not part of update checks.
- Downloading a model contacts its published host, including Hugging Face or GitHub, and their delivery infrastructure. Download requests do not contain your recordings or transcripts.
- Refreshing a hosted model catalogue or verifying a provider connection contacts the relevant provider. Authentication is included where required.
- Opening an external help or account link uses your browser. The linked site's own policies apply.

Each third-party provider, download host and sync operator has its own privacy and retention practices. Review the policies of the services you select. Dictum's zero-retention option requests supported provider flags; it does not independently guarantee deletion or retention behavior at a third party. See [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) and [Hugging Face's privacy policy](https://huggingface.co/privacy) for those hosts.

## Questions

For questions about this policy, contact the maintainer through the [project repository](https://github.com/Vkandil/dictum/issues). Do not include private recordings, transcripts, credentials or other sensitive information in a public issue. Follow [SECURITY.md](SECURITY.md) for private vulnerability reporting.
