# Code signing policy

## Current status

Dictum is preparing an application to the [SignPath Foundation](https://signpath.org/) open-source signing program. Acceptance has not been granted, and no Dictum release is currently signed by SignPath Foundation. This page does not claim sponsorship or approval. The existing v1.3.1 packages are not Authenticode-signed; the v1.4.0 release is a draft awaiting a signing configuration and release acceptance checks.

## Proposed signing process after acceptance

The project will integrate SignPath with its public GitHub Actions build workflow. Signing requests will cover Dictum's own Windows application, CLI and installers built from the project source. Third-party libraries retain their upstream signing status and licence notices; they will not be re-signed as if they were Dictum's own binaries.

- Maintainer, committer and reviewer: [Vkandil](https://github.com/Vkandil).
- Proposed release-signing approver: [Vkandil](https://github.com/Vkandil).
- External contributions to a signed release must be reviewed by the maintainer. Repository and signing access must use multi-factor authentication.
- Each release-signing request must receive manual approval. Installer signatures, timestamps, update signatures and checksums must be checked before publication.

If accepted, the signing attribution will be: "Free code signing provided by SignPath.io, certificate by SignPath Foundation". The current preparation status will be updated only after acceptance and successful integration.

## Privacy and downloads

See the [privacy policy](../PRIVACY.md) for local storage, hosted transcription, optional AI formatting and sync, model downloads and automatic update checks. Dictum has no application telemetry or Dictum-hosted transcription service.

The official download entry point is [Download and install](https://github.com/Vkandil/dictum#download-and-install). Release notes identify the packages available for each version. The signing policy for public Windows builds is also documented in [releasing.md](releasing.md).
