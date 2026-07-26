# Releasing Dictum for Windows

The `Windows Release` GitHub Actions workflow builds NSIS and MSI packages plus the signed Tauri updater manifest from a `v*` tag. Dictum publishes Windows artifacts only.

## Required GitHub secrets

These are required for every release. They only sign the auto-updater manifest and cost nothing.

- `TAURI_SIGNING_PRIVATE_KEY`: the Tauri updater private key (the contents of the minisign secret-key file). The matching public key is embedded in `src-tauri/tauri.conf.json`.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the updater-key password, or an empty value if the key has none.

## Optional GitHub secrets (Authenticode)

If both are set, the workflow Authenticode-signs the NSIS and MSI installers, which removes the Windows SmartScreen "unknown publisher" warning. If they are absent, the workflow still succeeds and publishes **unsigned** installers plus the signed updater manifest.

- `WINDOWS_CERTIFICATE`: a Base64-encoded Authenticode `.pfx` certificate.
- `WINDOWS_CERTIFICATE_PASSWORD`: the password for that certificate.

Back up the updater private key securely. Losing it prevents existing installations from trusting future automatic updates. Never commit updater keys, certificates, API keys, or passwords.

## Release procedure

1. Confirm the same version is present in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and `src-tauri/tauri.conf.json`.
2. Complete [windows-release-checklist.md](windows-release-checklist.md).
3. Merge to `main` and confirm the `Windows CI` workflow passes, including its dependency-audit job.
4. Create and push an annotated tag matching the version, for example `v1.2.0`.
5. Confirm the draft GitHub release contains the NSIS, MSI, updater manifest, and signature artifacts.
6. Download the artifacts onto a clean Windows VM and repeat the install, launch, long-dictation, update, and uninstall checks.
7. Verify the generated `SHA256SUMS.txt` file and add user-facing release notes.
8. Publish the draft release.

Example tag commands:

```powershell
git tag -a v1.2.0 -m "Dictum 1.2.0"
git push origin v1.2.0
```
