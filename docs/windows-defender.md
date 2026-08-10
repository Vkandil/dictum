# Windows Defender and SmartScreen

## What was found

The public Dictum 1.3.1 NSIS installer has the published SHA-256 hash `6ef584db7289d01660bf77fe3c86a5622413bf11a279f1c23af06efe12c3a887`, but it has no Authenticode signature. A current Microsoft Defender static scan of that exact installer reported no threats during this investigation. The locally built application, NSIS installer, and MSI also reported no static threats.

That does not make the old installer suitable for broad distribution. It has no publisher reputation, and Dictum legitimately combines several behaviours that antivirus heuristics treat cautiously: global shortcuts, a microphone, clipboard access, synthetic keyboard input, and optional launch-at-login. The keyboard listener is limited to handling Escape cancellation and the optional Right-Shift double tap; it does not retain or transmit keyboard input. It must not register or unregister a global shortcut while a shortcut callback is executing, because that can deadlock Windows' shortcut manager.

The diagnosis is therefore:

1. The Windows 10 "unknown publisher/potentially unsafe" experience is expected for the unsigned 1.3.1 release and its near-zero reputation.
2. Windows 11 Smart App Control can block unknown unsigned code outright. Microsoft documents that unknown unsigned code is blocked by default when enforcement is active.
3. A notification that names a threat (for example `Trojan:Win32/...` or `Behavior:Win32/...`) is a separate Defender antivirus verdict. Signing helps establish provenance but does not override such a verdict; the exact signed files must be submitted to Microsoft as false positives.

## Permanent release fix

Do all of the following for the next version:

1. Obtain a publicly trusted RSA Authenticode signing service or certificate. Follow [releasing.md](releasing.md); unsigned release jobs now fail closed.
2. Keep the same signing identity between releases so publisher reputation can accumulate. Always timestamp signatures.
3. Sign the inner `dictum.exe` and both outer installers. The workflow verifies all three before checksums are published.
4. Submit all three signed files to the [Microsoft Security Intelligence portal](https://www.microsoft.com/wdsi/filesubmission), choose **Software developer** and **incorrectly detected/clean**, and include the Defender threat name if one was shown.
5. Publish a new version rather than silently replacing 1.3.1. Every rebuild has a new file hash and must be scanned/submitted again.
6. Test the downloaded GitHub assets, not only local build outputs, on clean Windows 10 and Windows 11 VMs.

Publishing through the Microsoft Store is another strong option: Microsoft signs Store-distributed apps and those downloads do not receive SmartScreen download warnings. It requires a separate MSIX/Store packaging and policy-validation effort, so it is not a substitute for fixing the existing NSIS/MSI release pipeline.

Do not tell end users to disable Defender or add a permanent exclusion. Microsoft recommends exclusions only after root-cause analysis and false-positive submission because exclusions create a protection gap.

## Capturing a real Defender verdict

Open **Windows Security → Virus & threat protection → Protection history**, select the Dictum event, and record:

- the exact threat name;
- whether the affected path is the downloaded installer, installed `dictum.exe`, or updater temporary file;
- Defender security-intelligence version;
- first detection time and action taken.

The same details can often be extracted from an elevated PowerShell terminal:

```powershell
$since = (Get-Date).AddDays(-7)
Get-WinEvent -FilterHashtable @{
  LogName = 'Microsoft-Windows-Windows Defender/Operational'
  Id = 1116, 1117
  StartTime = $since
} | Where-Object Message -Match 'Dictum' |
  Select-Object TimeCreated, Id, Message | Format-List
```

For a static pre-release scan that reports detections without quarantining the release candidate, use Defender's `MpCmdRun.exe` custom scan with `-DisableRemediation`. Run it separately against `dictum.exe`, the NSIS `.exe`, and the `.msi`. This does not reproduce runtime behavioural detections, so the VM launch test remains required.

Suggested submission note:

> Dictum is an MIT-licensed, open-source Windows voice-dictation application built with Rust and Tauri. It records microphone audio on explicit shortcut activation and inserts the resulting text using clipboard paste or synthetic typing. It uses global shortcuts and offers opt-in launch at login. Source and reproducible GitHub Actions workflow: https://github.com/Vkandil/dictum. Please review this signed release as an incorrectly detected clean application.

Microsoft's relevant guidance:

- [SmartScreen reputation for Windows app developers](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation)
- [Smart App Control overview](https://learn.microsoft.com/windows/apps/develop/smart-app-control/overview)
- [Submit files for analysis](https://learn.microsoft.com/unified-secops/submission-guide)
- [Windows code signing in Tauri](https://v2.tauri.app/distribute/sign/windows/)
