# Releasing Dictum for Windows

The `Windows Release` GitHub Actions workflow builds NSIS and MSI packages plus the signed Tauri updater manifest from a `v*` tag. Dictum publishes Windows artifacts only.

## Required updater secrets

These are required for every release. They only sign the auto-updater manifest and cost nothing.

- `TAURI_SIGNING_PRIVATE_KEY`: the Tauri updater private key (the contents of the minisign secret-key file). The matching public key is embedded in `src-tauri/tauri.conf.json`.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the updater-key password, or an empty value if the key has none.

## Required Authenticode signing

The release workflow now refuses to publish an unsigned build. The Tauri updater signature proves an update came from Dictum, but it is not an Authenticode signature and Windows does not use it for Defender, SmartScreen, or Smart App Control.

Choose one signing route below. In both cases use an RSA Public Trust code-signing identity; Smart App Control does not currently accept ECC signatures.

### Route A: Azure Artifact Signing

This is Microsoft's recommended managed signing service. Public Trust is currently available to organizations in the EU (and certain other regions), while individual eligibility is more limited; check Microsoft's current [Artifact Signing FAQ](https://learn.microsoft.com/azure/artifact-signing/faq) before creating the resource.

Create these GitHub Actions secrets:

- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`

Create these GitHub Actions repository variables:

- `ARTIFACT_SIGNING_ENDPOINT`, for example `https://neu.codesigning.azure.net`
- `ARTIFACT_SIGNING_ACCOUNT`
- `ARTIFACT_SIGNING_PROFILE`

The service principal needs the **Artifact Signing Certificate Profile Signer** role for that certificate profile. The workflow installs the Tauri-documented `artifact-signing-cli` integration at a pinned version and lets Tauri sign the application before it is put inside either installer.

### Route B: exportable Authenticode PFX

Use this route only when the certificate provider gives you an exportable `.pfx` suitable for CI. Many newly issued certificates keep their key in an HSM or hardware token and therefore need that provider's remote-signing integration instead.

- `WINDOWS_CERTIFICATE`: a Base64-encoded Authenticode `.pfx` certificate.
- `WINDOWS_CERTIFICATE_PASSWORD`: the password for that certificate.

The workflow rejects expired certificates, certificates without a private key or code-signing EKU, and non-RSA certificates.

For an eligible non-commercial open-source project, [SignPath Foundation](https://signpath.org/) is a possible no-cost route. It has its own application and CI integration, so adapt the workflow only after the project is accepted. Do not put a self-signed certificate in the workflow: it changes the displayed publisher but is not publicly trusted by Windows.

Back up the updater private key securely. Losing it prevents existing installations from trusting future automatic updates. Never commit updater keys, certificates, API keys, or passwords.

## Release procedure

1. Confirm the same version is present in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and `src-tauri/tauri.conf.json`.
2. Complete [windows-release-checklist.md](windows-release-checklist.md).
3. Merge to `main` and confirm the `Windows CI` workflow passes, including its dependency-audit job.
4. Create and push an annotated tag matching the version, for example `v1.2.0`.
5. Confirm the workflow reports a valid Authenticode signer and timestamp for `dictum.exe`, the NSIS installer, and the MSI. A missing or invalid signature fails the workflow.
6. Confirm the draft GitHub release contains the NSIS, MSI, updater manifest, and signature artifacts.
7. Submit the signed application and both signed installers to the [Microsoft Security Intelligence sample portal](https://www.microsoft.com/wdsi/filesubmission) as a software developer. Select the clean/incorrectly detected option and retain the submission IDs.
8. Download the artifacts onto clean Windows 10 and Windows 11 VMs and repeat the install, launch, long-dictation, update, and uninstall checks. Include a Windows 11 VM with Smart App Control enabled.
9. Verify the generated `SHA256SUMS.txt` file and add user-facing release notes.
10. Publish the draft release.

See [windows-defender.md](windows-defender.md) for the difference between SmartScreen, Smart App Control, and a Defender antivirus detection, plus the false-positive response procedure.

Example tag commands:

```powershell
git tag -a v1.2.0 -m "Dictum 1.2.0"
git push origin v1.2.0
```
