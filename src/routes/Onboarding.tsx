import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, Check, KeyRound, Keyboard, Mic, ShieldCheck, Sparkles } from "lucide-react";
import { Button, Card, Field, Input, Select } from "../components/Ui";
import MicTest from "../components/MicTest";
import { cancelRecording, checkHotkey, listenDictation, openPermissions, saveApiKey, saveSettings, startRecording, stopRecording, validateApiKey } from "../lib/bridge";
import { displayShortcut, shortcutFromKeyEvent } from "../lib/hotkey";
import type { AppSettings, AudioDevice, DictationPhase, DictationState } from "../lib/types";
import dictumLogo from "../../logos/Dictum_png.png";
import dictumLogoOnWhite from "../../logos/Dictum_white_background.png";

interface OnboardingProps {
  initial: AppSettings;
  devices?: AudioDevice[];
  /** Masked previews of keys already in the OS keychain, per provider id. */
  apiKeyHints?: Record<string, string>;
  onComplete: () => Promise<void>;
}

/** The hosted services a first-time user can connect, with the model each one starts on.
 *  Mistral is offered here because Live mode requires it - sending everyone through
 *  OpenRouter first would mean creating an account they may never use. */
const HOSTED_PROVIDERS = [
  { id: "openrouter", name: "OpenRouter", model: "mistralai/voxtral-mini-transcribe", keyPrefix: "sk-or-v1-…", note: "One key, many models", console: "https://openrouter.ai/keys" },
  { id: "mistral", name: "Mistral", model: "voxtral-mini-latest", keyPrefix: "Your Mistral API key", note: "Required for Live mode", console: "https://console.mistral.ai" },
] as const;

function friendlyDictationError(error: unknown, errorCode?: string): string {
  const message = String(error).replace(/^Error:\s*/i, "");
  if (errorCode === "quota" || /quota|credits|payment required/i.test(message)) {
    return "Your API key was accepted, but the service reports no available credits or spending quota. Add credits or raise the spending limit in your provider account, then retry — or choose a local provider.";
  }
  if (errorCode === "invalid_key" || /API key rejected/i.test(message)) {
    return "The service rejected this key. Return to the Connect step and validate a current key.";
  }
  if (errorCode === "empty_audio" || /no speech detected/i.test(message)) {
    return "No speech was detected. Check the selected microphone, watch the signal meter, and speak for a few seconds before stopping.";
  }
  if (/os error 2|fichier spécifié est introuvable|file specified cannot be found/i.test(message)) {
    return "Windows could not open the selected microphone or Settings page. Choose another microphone below and confirm that desktop apps may use the microphone in Windows Privacy settings.";
  }
  return message;
}

function friendlyShortcutError(error: unknown): string {
  const message = String(error).replace(/^Error:\s*/i, "");
  if (/os error 2|fichier spécifié est introuvable|file specified cannot be found/i.test(message)) {
    return "Windows could not register this shortcut. Choose another suggestion and try again.";
  }
  if (/already registered|conflict/i.test(message)) {
    return "This shortcut is already used by Dictum, Windows, or another application. Choose another one.";
  }
  return `Dictum could not save this shortcut: ${message}`;
}

export default function Onboarding({ initial, devices = [], apiKeyHints = {}, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(() => {
    if ("__TAURI_INTERNALS__" in window) return 0;
    const preview = Number(new URLSearchParams(location.search).get("onboardingStep") ?? 0);
    return Number.isInteger(preview) && preview >= 0 && preview <= 4 ? preview : 0;
  });
  const [settings, setSettings] = useState(initial);
  const [apiKey, setApiKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [provider, setProvider] = useState<string>(() =>
    HOSTED_PROVIDERS.some((item) => item.id === initial.provider) ? initial.provider : HOSTED_PROVIDERS[0].id);
  const hosted = HOSTED_PROVIDERS.find((item) => item.id === provider) ?? HOSTED_PROVIDERS[0];
  const savedKey = apiKeyHints[provider];
  const [keyOk, setKeyOk] = useState(Boolean(apiKeyHints[initial.provider]));
  const [recording, setRecording] = useState(false);
  const [dictationPhase, setDictationPhase] = useState<DictationPhase>("idle");
  const [micLevel, setMicLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [sandboxText, setSandboxText] = useState("");
  const [setupError, setSetupError] = useState("");
  const [micPermission, setMicPermission] = useState<"idle" | "checking" | "ready" | "error">("idle");
  const [capturingShortcut, setCapturingShortcut] = useState(false);
  const [hotkeyStatus, setHotkeyStatus] = useState("");
  const [savingStep, setSavingStep] = useState(false);
  const stepRef = useRef(step);
  const trialActiveRef = useRef(false);
  stepRef.current = step;
  const steps = ["Welcome", "Connect", "Permissions", "Shortcut", "Try it"];
  const presets = useMemo(() => [
    { combo: "CommandOrControl+Shift+Space", label: "Recommended" },
    { combo: "CommandOrControl+Alt+D", label: "Alternative" },
    { combo: "CommandOrControl+Shift+D", label: "Compact" },
  ], []);

  const next = () => setStep((value) => Math.min(value + 1, steps.length - 1));
  const verify = async () => {
    setChecking(true);
    setSetupError("");
    try {
      await validateApiKey(provider, apiKey);
      await saveApiKey(provider, apiKey);
      // Adopt the service that was just proven to work, along with a model it actually serves.
      setSettings((current) => ({ ...current, provider, model: hosted.model }));
      setKeyOk(true);
    } catch (error) {
      setKeyOk(false);
      setSetupError(friendlyDictationError(error));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    let off: (() => void) | undefined;
    void listenDictation((state: DictationState) => {
      // Permission checks and global shortcuts also emit dictation events. Only
      // surface transcription feedback during a trial on the final page.
      if (stepRef.current !== 4) return;
      if (state.phase === "listening") trialActiveRef.current = true;
      if (!trialActiveRef.current) return;
      setDictationPhase(state.phase);
      if (state.phase === "listening" && typeof state.level === "number") {
        setMicLevel(state.level);
        setPeakLevel((value) => Math.max(value, state.level ?? 0));
      }
      if (state.phase === "result" && state.text) {
        setSandboxText(state.text);
        setSetupError("");
      }
      if (state.phase === "error") setSetupError(friendlyDictationError(state.message ?? "Dictation failed", state.errorCode));
      if (["transcribing", "result", "error", "cancelled"].includes(state.phase)) setRecording(false);
      if (["result", "error", "cancelled"].includes(state.phase)) trialActiveRef.current = false;
    }).then((unlisten) => { off = unlisten; });
    return () => off?.();
  }, []);

  const persistProgress = async () => {
    setSavingStep(true);
    setSetupError("");
    try {
      await saveSettings({ ...settings, onboardingComplete: false });
      next();
    } catch (error) {
      setSetupError(friendlyShortcutError(error));
    } finally {
      setSavingStep(false);
    }
  };

  const finish = async () => {
    setSetupError("");
    try {
      await saveSettings({ ...settings, onboardingComplete: true });
      await onComplete();
    } catch (error) {
      setSetupError(friendlyDictationError(error));
    }
  };

  const requestMicrophone = async () => {
    setMicPermission("checking");
    setSetupError("");
    try {
      await saveSettings({ ...settings, onboardingComplete: false });
      await startRecording(false);
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      await cancelRecording();
      setMicPermission("ready");
    } catch (error) {
      setMicPermission("error");
      setSetupError(friendlyDictationError(error));
      try { await openPermissions("microphone"); } catch { /* The actionable message remains visible. */ }
    }
  };

  const chooseShortcut = async (combo: string) => {
    setCapturingShortcut(false);
    setHotkeyStatus("Checking shortcut…");
    try {
      await checkHotkey(combo);
      setSettings((value) => ({ ...value, hotkey: { ...value.hotkey, combo } }));
      setHotkeyStatus("Shortcut available and selected");
      setSetupError("");
    } catch (error) {
      setHotkeyStatus("");
      setSetupError(friendlyShortcutError(error));
    }
  };

  const captureShortcut = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!capturingShortcut) return;
    event.preventDefault();
    event.stopPropagation();
    const captured = shortcutFromKeyEvent(event.nativeEvent);
    if (captured.cancelled) {
      setCapturingShortcut(false);
      setHotkeyStatus("Shortcut capture cancelled");
    } else if (captured.error) {
      setHotkeyStatus("");
      setSetupError(captured.error);
    } else if (captured.combo) {
      void chooseShortcut(captured.combo);
    }
  };

  const toggleTrial = async () => {
    setSetupError("");
    if (recording) {
      setRecording(false);
      setDictationPhase("transcribing");
      try { await stopRecording(); } catch (error) { setSetupError(friendlyDictationError(error)); }
      return;
    }
    setSandboxText("");
    setMicLevel(0);
    setPeakLevel(0);
    setDictationPhase("listening");
    trialActiveRef.current = true;
    try {
      await startRecording(false);
      setRecording(true);
    } catch (error) {
      trialActiveRef.current = false;
      setRecording(false);
      setDictationPhase("error");
      setSetupError(friendlyDictationError(error));
    }
  };

  const visualLevel = Math.min(1, Math.sqrt(micLevel * 8));
  const trialStatus = recording
    ? "Listening — speak now"
    : dictationPhase === "transcribing" || dictationPhase === "formatting"
      ? "Transcribing your test…"
      : dictationPhase === "result"
        ? "Transcript ready"
        : dictationPhase === "error"
          ? "Test needs attention"
          : "Ready for a test dictation";

  return <main className="onboarding">
    <div className="onboarding-brand"><div className="brand-mark light"><img src={dictumLogoOnWhite} alt="" /></div><span>Dictum</span></div>
    <div className="stepper">{steps.map((label, index) => <div key={label} className={index <= step ? "active" : ""}><i>{index < step ? <Check size={12} /> : index + 1}</i><span>{label}</span></div>)}</div>
    <section className="onboarding-stage">
      {step === 0 ? <div className="onboarding-copy welcome"><div className="hero-orb"><img src={dictumLogo} alt="Dictum" /></div><p className="eyebrow">Open source voice dictation</p><h1>Your voice,<br /><em>everywhere.</em></h1><p>Speak naturally and Dictum inserts polished text into any app. Bring your own key, run locally when you want, and keep complete control of your data.</p><div className="trust-row"><span><ShieldCheck size={16} />No telemetry</span><span><KeyRound size={16} />Keys in OS keychain</span><span><Sparkles size={16} />MIT licensed</span></div></div> : null}

      {step === 1 ? <div className="onboarding-copy"><div className="step-icon"><KeyRound /></div><p className="eyebrow">Step 1</p><h1>Connect a service</h1><p>Dictum sends your speech to the service you pick, using your own key. Both are pay-as-you-go with no subscription, at roughly $0.003 per minute.</p>
        <div className="provider-choice">{HOSTED_PROVIDERS.map((item) => <button type="button" key={item.id} className={`provider-option ${provider === item.id ? "selected" : ""}`} aria-pressed={provider === item.id} onClick={() => { setProvider(item.id); setApiKey(""); setKeyOk(Boolean(apiKeyHints[item.id])); setSetupError(""); }}><strong>{item.name}</strong><span>{item.note}</span>{apiKeyHints[item.id] ? <small className="provider-saved"><Check size={12} />Key saved</small> : null}</button>)}</div>
        <Card className="connect-card"><Field label={`${hosted.name} API key`} hint={savedKey && !apiKey ? `A saved key (${savedKey}) is ready in Windows Credential Manager.` : <>Stored in Windows Credential Manager. Create one at <a href={hosted.console} target="_blank" rel="noreferrer">{hosted.console.replace("https://", "")}</a>.</>}><Input type="password" autoFocus placeholder={savedKey ? "Saved key — enter a new one to replace it" : hosted.keyPrefix} value={apiKey} onChange={(event) => { setApiKey(event.target.value); setKeyOk(Boolean(savedKey) && !event.target.value); setSetupError(""); }} /></Field><Button busy={checking} disabled={!apiKey || checking} onClick={() => void verify()}>{keyOk && !apiKey ? <Check size={16} /> : null}{keyOk && !apiKey ? "Connected" : "Validate key"}</Button></Card>
        {setupError ? <p className="field-error onboarding-error">{setupError}</p> : null}
        <button className="text-link" onClick={() => { setSettings({ ...settings, provider: "local", model: "mistralai/Voxtral-Mini-3B-2507" }); setSetupError(""); next(); }}>Use a local provider instead — no key, nothing leaves your machine</button></div> : null}

      {step === 2 ? <div className="onboarding-copy"><div className="step-icon"><ShieldCheck /></div><p className="eyebrow">Step 2</p><h1>Check your microphone.</h1><p>Pick the microphone you want to use, then run the test and speak — the meter should move.</p><div className="permission-list"><Card><div className="permission-icon"><Mic /></div><div><h3>Microphone</h3><p>{devices.length ? `${devices.length} input device${devices.length === 1 ? "" : "s"} detected` : "No input device was detected by Dictum"}</p>{devices.length ? <Select aria-label="Microphone" value={settings.microphoneId ?? ""} onChange={(event) => { setSettings({ ...settings, microphoneId: event.target.value || null }); setMicPermission("idle"); }}><option value="">System default</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}{device.isDefault ? " (default)" : ""}</option>)}</Select> : null}</div><MicTest deviceId={settings.microphoneId ?? null} label="Test microphone" onError={(error: unknown) => { setSetupError(friendlyDictationError(error)); void openPermissions("microphone").catch(() => { /* The actionable message remains visible. */ }); }} /></Card><Card><div className="permission-icon"><Keyboard /></div><div><h3>System-wide typing</h3><p>Dictum uses standard Windows input APIs to paste at your cursor.</p></div><span className="permission-ok"><Check />Ready</span></Card></div>{setupError ? <p className="field-error onboarding-error">{setupError}</p> : null}</div> : null}

      {step === 3 ? <div className="onboarding-copy"><div className="step-icon"><Keyboard /></div><p className="eyebrow">Step 3</p><h1>Choose your shortcut</h1><p>Pick a suggestion or record the exact key combination you want. You never need to type shortcut syntax.</p><Card className="shortcut-card redesigned"><Field label="Dictation shortcut"><div className="shortcut-capture-row"><output className="shortcut-display">{settings.hotkey.mode === "doubleTap" ? "Right Shift twice" : displayShortcut(settings.hotkey.combo)}</output><button type="button" className={`shortcut-record ${capturingShortcut ? "capturing" : ""}`} onClick={() => { setCapturingShortcut(true); setHotkeyStatus("Press your key combination now — Esc cancels"); setSetupError(""); }} onKeyDown={captureShortcut} disabled={settings.hotkey.mode === "doubleTap"}>{capturingShortcut ? "Press keys…" : "Record shortcut"}</button></div></Field><Field label="Behavior"><Select value={settings.hotkey.mode} onChange={(event) => { setSettings({ ...settings, hotkey: { ...settings.hotkey, mode: event.target.value as AppSettings["hotkey"]["mode"] } }); setCapturingShortcut(false); }}><option value="hold">Hold to talk</option><option value="toggle">Press to start / stop</option><option value="doubleTap">Double-tap right Shift</option></Select></Field><div className="shortcut-presets" aria-label="Shortcut suggestions">{presets.map((preset) => <button type="button" key={preset.combo} className={settings.hotkey.combo === preset.combo && settings.hotkey.mode !== "doubleTap" ? "selected" : ""} onClick={() => void chooseShortcut(preset.combo)}><span>{displayShortcut(preset.combo)}</span><small>{preset.label}</small></button>)}</div>{hotkeyStatus ? <p className="shortcut-status"><Check size={14} />{hotkeyStatus}</p> : null}{setupError ? <p className="field-error onboarding-error">{setupError}</p> : null}</Card></div> : null}

      {step === 4 ? <div className="onboarding-copy"><div className="step-icon"><Mic /></div><p className="eyebrow">Final step</p><h1>Give it a voice.</h1><p><strong>On this page, click the button below</strong> to start and stop. Your saved shortcut also works now and is what you’ll normally use from other apps.</p><Card className="sandbox redesigned"><div className="trial-toolbar"><div><strong>{trialStatus}</strong><span>{recording && visualLevel < 0.08 ? "Speak now—if the meter stays flat, return and choose another microphone." : recording ? "Your microphone signal is moving." : `Shortcut: ${displayShortcut(settings.hotkey.combo)}`}</span></div><div className="mic-meter" role="meter" aria-label="Microphone signal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(visualLevel * 100)}>{Array.from({ length: 12 }, (_, index) => <i key={index} className={(index + 1) / 12 <= visualLevel ? "active" : ""} />)}</div></div><textarea className="input" placeholder="Your first dictation will appear here…" rows={5} value={sandboxText} onChange={(event) => setSandboxText(event.target.value)} /><button aria-label={recording ? "Stop and transcribe test dictation" : "Start test dictation"} className={`trial-record-button ${recording ? "recording" : ""}`} onClick={() => void toggleTrial()}><Mic size={19} />{recording ? "Stop & transcribe" : "Start test dictation"}</button></Card>{peakLevel > 0.003 && setupError ? <p className="mic-confirmation"><Check size={14} />Your microphone is working; the remaining issue is with transcription.</p> : null}{setupError ? <div className="trial-error"><p>{setupError}</p>{/credits|quota/i.test(setupError) ? <button className="text-link" onClick={() => { setStep(1); setSetupError(""); }}>Back to provider setup</button> : null}</div> : null}
        {/* Live mode is otherwise undiscoverable: nothing on the way in mentions it, so you'd
            have to already know it exists to go looking in Settings for it. */}
        <p className="onboarding-tip"><Sparkles size={14} /><span><strong>Prefer to watch your words appear as you speak?</strong> Dictum can also transcribe live, straight into whatever you're typing in. Turn it on later in <strong>Settings → How your text appears</strong> — it needs a Mistral key and trades AI clean-up for instant text.</span></p></div> : null}
    </section>
    <footer className="onboarding-footer"><Button variant="ghost" disabled={step === 0 || recording} onClick={() => { setStep((value) => value - 1); setSetupError(""); }}><ArrowLeft size={16} />Back</Button><span>{step + 1} / {steps.length}</span>{step < steps.length - 1 ? <Button busy={savingStep} disabled={(step === 1 && settings.provider !== "local" && !keyOk) || recording} onClick={() => step === 3 ? void persistProgress() : next()}>Continue<ArrowRight size={16} /></Button> : <Button disabled={recording} onClick={() => void finish()}>Finish setup<Check size={16} /></Button>}</footer>
  </main>;
}
