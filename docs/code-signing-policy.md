# Code signing policy

## Current status

Dictum distributes Windows installers without an Authenticode publisher certificate. This is intentional and is disclosed on the download page and in release notes. Windows may show an unknown-publisher warning, and Smart App Control or an organization's policy may block installation.

The SignPath Foundation application was not accepted. Dictum does not use SignPath signing and does not claim its sponsorship. Purchasing a Windows certificate is not a prerequisite for downloading models, using Dictum or preparing a GitHub release.

## Release integrity

- Official packages are built from the public repository by GitHub Actions and published at [GitHub Releases](https://github.com/Vkandil/dictum/releases).
- Each release includes SHA-256 checksums for its NSIS and MSI installers.
- Automatic updates retain the existing Tauri cryptographic signatures. These allow an installed copy of Dictum to verify an update; they are separate from Windows Authenticode and do not establish Windows publisher reputation.
- The maintainer, [Vkandil](https://github.com/Vkandil), reviews the release draft before publishing it.
- Third-party native libraries retain their upstream licensing and signing status. Their notices are included in the Windows packages.

If an Authenticode identity is configured later, the release workflow uses it and requires valid timestamped signatures. An incomplete or failing signing configuration fails the job instead of silently producing unsigned files. The Tauri updater key is required in both modes and must not be replaced for routine releases.

## Windows security messages

A publisher warning and a named antivirus detection are different. Check the exact file and its release checksum. Do not disable antivirus protection to run Dictum. A named detection should be investigated and, where appropriate, submitted to Microsoft for review. See [Windows Defender and SmartScreen](windows-defender.md).

## Privacy and downloads

See the [privacy policy](../PRIVACY.md) for local storage, hosted transcription, optional AI formatting and sync, model downloads and automatic update checks. Dictum has no application telemetry or Dictum-hosted transcription service.

The official download entry point is [Download and install](https://github.com/Vkandil/dictum#download-and-install). Release notes identify the packages available for each version. The signing policy for public Windows builds is also documented in [releasing.md](releasing.md).
