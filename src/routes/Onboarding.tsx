import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, AudioLines, Check, KeyRound, Keyboard, Mic, ShieldCheck, Sparkles } from "lucide-react";
import { Button, Card, Field, Input, Select } from "../components/Ui";
import { cancelRecording, listenDictation, openPermissions, saveApiKey, saveSettings, startRecording, stopRecording, validateApiKey } from "../lib/bridge";
import type { AppSettings } from "../lib/types";

export default function Onboarding({ initial, platform, onComplete }: { initial: AppSettings; platform: string; onComplete: () => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState(initial);
  const [apiKey, setApiKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [keyOk, setKeyOk] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [recording, setRecording] = useState(false);
  const [sandboxText, setSandboxText] = useState("");
  const [setupError, setSetupError] = useState("");
  const [micPermission, setMicPermission] = useState<"idle" | "checking" | "ready" | "error">("idle");
  const isMac = platform.toLowerCase().includes("mac");
  const steps = ["Welcome", "Connect", "Permissions", "Shortcut", "Try it"];
  const next = () => setStep((value) => Math.min(value + 1, steps.length - 1));
  const verify = async () => { setChecking(true); setKeyError(""); try { await validateApiKey("openrouter", apiKey); await saveApiKey("openrouter", apiKey); setKeyOk(true); } catch (error) { setKeyError(String(error)); } finally { setChecking(false); } };
  useEffect(() => {
    let off: (() => void) | undefined;
    void listenDictation((state) => {
      if (state.phase === "result" && state.text) setSandboxText(state.text);
      if (["result", "error", "cancelled"].includes(state.phase)) setRecording(false);
    }).then((unlisten) => { off = unlisten; });
    return () => off?.();
  }, []);
  const finish = async () => { setSetupError(""); try { await saveSettings({ ...settings, onboardingComplete: true }); await onComplete(); } catch (error) { setSetupError(String(error)); } };
  const requestMicrophone = async () => { setMicPermission("checking"); try { await startRecording(false); await cancelRecording(); setMicPermission("ready"); } catch (error) { setMicPermission("error"); setSetupError(String(error)); await openPermissions("microphone"); } };
  return <main className="onboarding">
    <div className="onboarding-brand"><div className="brand-mark"><AudioLines size={20} /></div><span>Utter</span></div>
    <div className="stepper">{steps.map((label, index) => <div key={label} className={index <= step ? "active" : ""}><i>{index < step ? <Check size={12} /> : index + 1}</i><span>{label}</span></div>)}</div>
    <section className="onboarding-stage">
      {step === 0 ? <div className="onboarding-copy welcome"><div className="hero-orb"><AudioLines size={48} /></div><p className="eyebrow">Open source voice dictation</p><h1>Your voice,<br /><em>everywhere.</em></h1><p>Speak naturally and Utter inserts polished text into any app. Bring your own key, run locally when you want, and keep complete control of your data.</p><div className="trust-row"><span><ShieldCheck size={16} />No telemetry</span><span><KeyRound size={16} />Keys in OS keychain</span><span><Sparkles size={16} />MIT licensed</span></div></div> : null}
      {step === 1 ? <div className="onboarding-copy"><div className="step-icon"><KeyRound /></div><p className="eyebrow">Step 1</p><h1>Connect OpenRouter</h1><p>Utter uses your key directly. At roughly $0.003 per minute, an hour of dictation costs about 18 cents. The key never enters app storage or logs.</p><Card className="connect-card"><Field label="OpenRouter API key" hint="Stored securely in Keychain, Credential Manager, or Secret Service."><Input type="password" autoFocus placeholder="sk-or-v1-…" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setKeyOk(false); setKeyError(""); }} />{keyError ? <span className="field-error">{keyError}</span> : null}</Field><Button busy={checking} disabled={!apiKey || keyOk} onClick={() => void verify()}>{keyOk ? <Check size={16} /> : null}{keyOk ? "Connected" : "Validate key"}</Button></Card><button className="text-link" onClick={() => { setSettings({ ...settings, provider: "local", model: "mistralai/Voxtral-Mini-3B-2507" }); next(); }}>Use a local provider instead</button></div> : null}
      {step === 2 ? <div className="onboarding-copy"><div className="step-icon"><ShieldCheck /></div><p className="eyebrow">Step 2</p><h1>Two permissions,<br />one-time only.</h1><p>Utter needs your microphone to hear you and system input access to paste at your cursor.</p><div className="permission-list"><Card><div className="permission-icon"><Mic /></div><div><h3>Microphone</h3><p>Capture only while your shortcut is active.</p></div><Button variant="secondary" busy={micPermission === "checking"} onClick={() => void requestMicrophone()}>{micPermission === "ready" ? <Check size={16} /> : null}{micPermission === "ready" ? "Allowed" : "Allow"}</Button></Card>{isMac ? <Card><div className="permission-icon"><Keyboard /></div><div><h3>Accessibility</h3><p>Paste text into the app under your cursor.</p></div><Button variant="secondary" onClick={() => void openPermissions("accessibility")}>Open settings</Button></Card> : <Card><div className="permission-icon"><Keyboard /></div><div><h3>System-wide typing</h3><p>No extra setup is normally required on Windows or X11.</p></div><span className="permission-ok"><Check />Ready</span></Card>}</div>{micPermission === "error" && setupError ? <p className="field-error">{setupError}</p> : null}</div> : null}
      {step === 3 ? <div className="onboarding-copy"><div className="step-icon"><Keyboard /></div><p className="eyebrow">Step 3</p><h1>Choose your shortcut</h1><p>Use a classic hold-to-talk key or toggle recording with each press. You can change this anytime.</p><Card className="shortcut-card"><Field label="Shortcut"><Input value={settings.hotkey.combo} onChange={(e) => setSettings({ ...settings, hotkey: { ...settings.hotkey, combo: e.target.value } })} /></Field><Field label="Behavior"><Select value={settings.hotkey.mode} onChange={(e) => setSettings({ ...settings, hotkey: { ...settings.hotkey, mode: e.target.value as AppSettings["hotkey"]["mode"] } })}><option value="hold">Hold to talk</option><option value="toggle">Press to start / stop</option><option value="doubleTap">Double-tap right Shift</option></Select></Field>{isMac && settings.hotkey.mode === "doubleTap" ? <Button variant="secondary" onClick={() => void openPermissions("inputMonitoring")}>Allow Input Monitoring</Button> : null}</Card></div> : null}
      {step === 4 ? <div className="onboarding-copy"><div className="step-icon"><Mic /></div><p className="eyebrow">Final step</p><h1>Give it a voice.</h1><p>Click the microphone, say a sentence, and stop. In the real world you’ll use your shortcut from any app.</p><Card className="sandbox"><textarea className="input" placeholder="Your first dictation will land here…" rows={5} value={sandboxText} onChange={(event) => setSandboxText(event.target.value)} /><button aria-label={recording ? "Stop test dictation" : "Start test dictation"} className={`record-button small ${recording ? "recording" : ""}`} onClick={async () => { if (recording) { await stopRecording(); } else { await startRecording(false); setRecording(true); } }}><Mic /></button></Card>{setupError ? <p className="field-error">{setupError}</p> : null}</div> : null}
    </section>
    <footer className="onboarding-footer"><Button variant="ghost" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ArrowLeft size={16} />Back</Button><span>{step + 1} / {steps.length}</span>{step < steps.length - 1 ? <Button disabled={step === 1 && settings.provider !== "local" && !keyOk} onClick={next}>Continue<ArrowRight size={16} /></Button> : <Button onClick={() => void finish()}>Finish setup<Check size={16} /></Button>}</footer>
  </main>;
}
