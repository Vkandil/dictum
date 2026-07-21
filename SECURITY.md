# Security policy

Please report vulnerabilities privately through GitHub Security Advisories rather than a public issue. Include affected versions, platform, impact, and reproduction steps.

Dictum’s trust boundaries are deliberately small:

- API keys are stored only through the OS credential service.
- Provider manifests are validated data; they are not executable plugins.
- Plain HTTP provider and sync URLs should only target loopback development services.
- Audio exists only in memory and is never included in logs or history.
- Sync payloads use Argon2-derived AES-256-GCM encryption before upload.

No support window is promised before the first stable release. Security fixes target the latest release branch.
