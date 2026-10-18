# Releasing Dictum for Windows

The Windows Release workflow builds NSIS and MSI packages from a clean GitHub Actions checkout. It prepares a draft; publication remains a maintainer action. Windows 10/11 x64 are the supported targets.

## Signing modes

Windows Authenticode publisher signing is optional. With no Windows certificate or Azure signing configuration, the workflow explicitly builds an **unsigned** release. Release notes and the download page disclose this status. Windows can warn about or block unsigned applications; a Tauri update signature does not establish Windows publisher reputation.

Tauri updater signing is required in every mode:

- `TAURI_SIGNING_PRIVATE_KEY`: keep the existing private key matching the public key in `src-tauri/tauri.conf.json`.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: required only when that key has a password.

Do not replace the updater key for routine releases. Never commit keys or passwords.

If Windows publisher signing becomes available, configure either:

- `WINDOWS_CERTIFICATE` (Base64 PFX) and `WINDOWS_CERTIFICATE_PASSWORD`, for an exportable RSA code-signing certificate suitable for CI; or
- secrets `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, plus variables `ARTIFACT_SIGNING_ENDPOINT`, `ARTIFACT_SIGNING_ACCOUNT`, `ARTIFACT_SIGNING_PROFILE`.

The workflow prioritizes a complete Azure configuration, then PFX. Incomplete credentials or a signing failure fail the build rather than silently downgrading the configured signer. Signed mode requires valid timestamped Authenticode signatures on the application, CLI and installers. The current release does not use SignPath Foundation.

## Procedure

1. Match the version in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` and `src-tauri/tauri.conf.json`.
2. Push to `main` and confirm Windows CI, including its dependency-audit job, succeeds for the commit being released.
3. Open **Actions > Windows Release > Run workflow**, select `main` and run. A matching `v*` tag can also trigger the workflow. Do not reuse an existing published version.
4. Confirm the build succeeds, its signing mode matches the release notes, and the draft contains both installers, their Tauri `.sig` files, `latest.json` and `SHA256SUMS.txt`.
5. Download the actual GitHub assets. Verify installer hashes and Tauri signatures against the existing updater public key. Exercise packaged native inference and perform the [Windows checklist](windows-release-checklist.md). Record outstanding acceptance checks rather than claiming unperformed tests passed.
6. Review the draft notes: local model weights download separately; installers are unsigned in the current release; GPU, paid-cloud accounts and clean Windows installation/update coverage must be described accurately.
7. Publish the reviewed draft and mark the intended stable version as latest. Verify `/releases/latest` and the updater manifest target that version.

See the [French click-by-click guide](github-publication.fr.md), [code signing policy](code-signing-policy.md) and [Windows security guide](windows-defender.md). Investigate any named antivirus detection and submit false positives to Microsoft; do not tell users to disable antivirus protection.
