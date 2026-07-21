# Releasing

The `release.yml` workflow builds platform bundles and a signed Tauri updater manifest from a `v*` tag.

The updater keypair for this checkout is in the git-ignored `.secrets/` directory. Back up the private key before the first public release: losing it prevents future updates to installed clients.

Configure these GitHub secrets before the first public release:

- `TAURI_SIGNING_PRIVATE_KEY`: the contents of the locally generated, git-ignored `.secrets/dictum-updater.key`. The matching public key is already embedded in `src-tauri/tauri.conf.json`. Set `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` to an empty value for this key.
- Apple: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `KEYCHAIN_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID`.
- Windows: `WINDOWS_CERTIFICATE` and `WINDOWS_CERTIFICATE_PASSWORD`, or the appropriate Azure Trusted Signing variables supported by the current Tauri action.

Release procedure:

1. Update versions in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Run all local checks and the platform smoke-test list in `spec-coverage.md`.
3. Merge to `main`, tag `vX.Y.Z`, and push the tag.
4. Confirm the draft GitHub release contains `.dmg`, `.msi`/NSIS, `.AppImage`, `.deb`, and `latest.json` artifacts as applicable.
5. Test updater installation from the previous version, then publish the draft.

Never commit signing keys, certificates, API keys, or notarization passwords.
