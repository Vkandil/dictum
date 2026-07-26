import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { CheckCircle2, ChevronDown, CloudCog, Eye, EyeOff, KeyRound, Mic, Plus, Save, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button, Card, Field, Input, Select, Toggle } from "../components/Ui";
import MicTest from "../components/MicTest";
import { checkHotkey, runSync, saveApiKey, saveProvider, saveSettings, validateApiKey } from "../lib/bridge";
import { displayShortcut, friendlyShortcutError, shortcutFromKeyEvent } from "../lib/hotkey";
import type { AppSettings, AudioDevice, ProviderManifest } from "../lib/types";

const LANGUAGES = [["auto", "Auto-detect / code-switch"], ["en", "English"], ["fr", "Français"], ["es", "Español"], ["de", "Deutsch"], ["it", "Italiano"], ["pt", "Português"], ["nl", "Nederlands"], ["ar", "العربية"], ["hi", "हिन्दी"], ["ja", "日本語"], ["zh", "中文"]];
const CUSTOM_MODEL = "__custom__";

/** Shortcut behaviors that don't keep a key held while you speak - the only ones live
 *  transcription can work with, since held modifiers turn typed characters into shortcuts. */
const LIVE_SAFE_MODES = ["toggle", "doubleTap"];

export default function Settings({ initial, providers, devices, apiKeyHints, onSaved }: { initial: AppSettings; providers: ProviderManifest[]; devices: AudioDevice[]; apiKeyHints: Record<string, string>; onSaved: () => Promise<void> }) {
  const [settings, setSettings] = useState(initial);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyState, setKeyState] = useState<"idle" | "checking" | "valid" | "error">("idle");
  const [keyError, setKeyError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [capturing, setCapturing] = useState<"dictation" | "command" | null>(null);
  const [shortcutError, setShortcutError] = useState("");
  const [replacingKey, setReplacingKey] = useState(false);
  const [modeNotice, setModeNotice] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [syncPassword, setSyncPassword] = useState("");
  const [syncAuthPassword, setSyncAuthPassword] = useState("");
  const [syncStatus, setSyncStatus] = useState("");
  const [plugin, setPlugin] = useState({ id: "", name: "", baseUrl: "", model: "" });
  const [pluginStatus, setPluginStatus] = useState("");

  const provider = useMemo(() => providers.find((item) => item.id === settings.provider), [providers, settings.provider]);
  const realtimeProviders = useMemo(() => providers.filter((item) => item.supportsRealtime), [providers]);
  const live = settings.realtime.enabled;
  const savedKey = apiKeyHints[settings.provider];
  // Keys belonging to services you're not currently using still matter - they're why switching
  // service can just work - so surface them instead of leaving the user wondering.
  const otherKeys = useMemo(() => Object.entries(apiKeyHints).filter(([id]) => id !== settings.provider), [apiKeyHints, settings.provider]);

  const patch = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => { setSettings((current) => ({ ...current, [key]: value })); setDirty(true); };
  const save = async () => { setSaving(true); setSaveError(""); try { await checkHotkey(settings.hotkey.combo); await saveSettings(settings); setDirty(false); await onSaved(); } catch (error) { setSaveError(String(error)); } finally { setSaving(false); } };

  /** Switching to live mode also moves an incompatible shortcut behavior out of the way, so the
   *  invalid combination the backend rejects can never be assembled here in the first place. */
  const chooseMode = (nextLive: boolean) => {
    setSettings((current) => {
      const mustSwitch = nextLive && !LIVE_SAFE_MODES.includes(current.hotkey.mode);
      // Never change the user's shortcut behavior silently - say so, right where they can see
      // the control that changed.
      setModeNotice(mustSwitch ? "Your shortcut is now press to start, press again to stop — live typing can't work while a key is held down." : "");
      return {
        ...current,
        realtime: { ...current.realtime, enabled: nextLive },
        hotkey: mustSwitch ? { ...current.hotkey, mode: "toggle" } : current.hotkey,
      };
    });
    setDirty(true);
  };

  // Same recorder the onboarding uses: press the real key combination instead of typing
  // shortcut syntax by hand. Availability is checked immediately so a conflicting combination
  // is rejected here rather than silently failing on save.
  const captureShortcut = async (target: "dictation" | "command", event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (capturing !== target) return;
    event.preventDefault();
    event.stopPropagation();
    const captured = shortcutFromKeyEvent(event.nativeEvent);
    if (captured.cancelled) { setCapturing(null); setShortcutError(""); return; }
    if (captured.error) { setShortcutError(captured.error); return; }
    if (!captured.combo) return;
    setCapturing(null);
    setShortcutError("");
    try {
      await checkHotkey(captured.combo);
      if (target === "dictation") patch("hotkey", { ...settings.hotkey, combo: captured.combo });
      else patch("commandHotkey", captured.combo);
    } catch (error) {
      setShortcutError(friendlyShortcutError(error));
    }
  };

  const checkKey = async () => { setKeyState("checking"); setKeyError(""); try { await validateApiKey(settings.provider, key || undefined); if (key) await saveApiKey(settings.provider, key); setKey(""); setKeyState("valid"); setReplacingKey(false); await onSaved(); } catch (error) { setKeyError(String(error)); setKeyState("error"); } };
  const syncNow = async (direction: "push" | "pull") => { setSyncStatus("Syncing…"); try { await runSync(direction, syncPassword, syncAuthPassword); setSyncStatus(direction === "push" ? "Encrypted data uploaded." : "Encrypted data restored."); if (direction === "pull") await onSaved(); } catch (error) { setSyncStatus(String(error)); } };
  const addPlugin = async () => { setPluginStatus(""); try { await saveProvider({ id: plugin.id, name: plugin.name, baseUrl: plugin.baseUrl, transcriptionPath: "/audio/transcriptions", chatPath: "/chat/completions", models: [plugin.model], supportsRealtime: false, requiresApiKey: true }); setPlugin({ id: "", name: "", baseUrl: "", model: "" }); setPluginStatus("Provider added."); await onSaved(); } catch (error) { setPluginStatus(String(error)); } };

  const shortcutRecorder = (target: "dictation" | "command", value: string, disabled?: boolean) =>
    <div className="shortcut-capture-row">
      <output className="shortcut-display">{disabled ? "Right Shift twice" : displayShortcut(value)}</output>
      <button type="button" className={`shortcut-record ${capturing === target ? "capturing" : ""}`} disabled={disabled} onClick={() => { setCapturing(target); setShortcutError(""); }} onKeyDown={(event) => void captureShortcut(target, event)}>{capturing === target ? "Press keys…" : "Record"}</button>
    </div>;

  const modelField = (label: string, value: string, options: string[], onChange: (model: string) => void) => {
    const known = options.includes(value);
    return <Field label={label} hint={known ? undefined : "Custom model"}>
      <Select value={known ? value : CUSTOM_MODEL} onChange={(event) => onChange(event.target.value === CUSTOM_MODEL ? "" : event.target.value)}>
        {options.map((model) => <option key={model} value={model}>{model}</option>)}
        <option value={CUSTOM_MODEL}>Custom…</option>
      </Select>
      {known ? null : <Input value={value} placeholder="Enter a model name" onChange={(event) => onChange(event.target.value)} />}
    </Field>;
  };

  return <div className="page">
    <header className="page-header compact"><div><p className="eyebrow">Make it yours</p><h1>Settings</h1><p>Changes stay on this device. API keys live only in your OS keychain.</p></div><div>{saveError ? <p className="field-error settings-error">{saveError}</p> : null}<Button variant={dirty ? "primary" : "secondary"} busy={saving} disabled={!dirty && !saving} onClick={() => void save()}>{dirty ? <><Save size={16} />Save changes</> : <><CheckCircle2 size={16} />Saved</>}</Button></div></header>

    <div className="settings-stack">
      <Card><div className="setting-heading"><CloudCog /><div><h2>Transcription service</h2><p>Who turns your speech into text, and in which language.</p></div></div><div className="form-grid">
        <Field label="Service"><Select value={settings.provider} onChange={(e) => { const next = providers.find((p) => p.id === e.target.value); setSettings((s) => ({ ...s, provider: e.target.value, model: next?.models[0] || s.model })); setDirty(true); }}>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Spoken language"><Select value={settings.language} onChange={(e) => patch("language", e.target.value)}>{LANGUAGES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select></Field>
      </div>
      {provider?.requiresApiKey
        ? savedKey && !replacingKey
          // A key is already stored for this service: show which one (last four characters
          // only) instead of an empty box that reads as "you haven't set this up yet".
          ? <div className="key-row saved"><KeyRound size={18} /><span className="key-saved-label"><CheckCircle2 size={15} />{provider.name} key saved</span><code className="key-mask">{savedKey}</code><Button variant="secondary" onClick={() => { setReplacingKey(true); setKeyState("idle"); setKeyError(""); }}>Replace</Button></div>
          : <div className="key-row"><KeyRound size={18} /><Input type={showKey ? "text" : "password"} value={key} placeholder={savedKey ? `Enter a new ${provider.name} key` : `Enter ${provider.name} API key`} onChange={(e) => { setKey(e.target.value); setKeyState("idle"); setKeyError(""); }} /><button className="icon-button" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button><Button variant="secondary" busy={keyState === "checking"} onClick={() => void checkKey()}>{keyState === "valid" ? <CheckCircle2 size={16} /> : null}{keyState === "valid" ? "Verified" : "Verify & save"}</Button>{savedKey ? <Button variant="ghost" onClick={() => { setReplacingKey(false); setKey(""); setKeyError(""); setKeyState("idle"); }}>Cancel</Button> : null}{keyState === "error" ? <span className="field-error">{keyError || "Key rejected"}</span> : null}</div>
        : <div className="local-notice"><ShieldCheck size={17} />No API key required. Audio never leaves your machine.</div>}
      {otherKeys.length ? <p className="field-help other-keys">Also saved: {otherKeys.map(([id, mask]) => `${providers.find((p) => p.id === id)?.name ?? id} (${mask})`).join(" · ")}</p> : null}
      </Card>

      <Card><div className="setting-heading"><Mic /><div><h2>Microphone & shortcut</h2><p>How you start and stop dictating.</p></div></div><div className="form-grid">
        <Field label="Microphone"><Select value={settings.microphoneId || ""} onChange={(e) => patch("microphoneId", e.target.value || null)}><option value="">System default</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select><MicTest deviceId={settings.microphoneId} /></Field>
        <Field label="How the shortcut works"><Select value={settings.hotkey.mode} onChange={(e) => { patch("hotkey", { ...settings.hotkey, mode: e.target.value as AppSettings["hotkey"]["mode"] }); setCapturing(null); setModeNotice(""); }}>
          {/* Kept visible but disabled while Live is on: an option that silently disappears
              leaves people wondering whether they imagined it. Greyed out with the reason
              spelled out below explains the constraint instead of hiding it. */}
          <option value="hold" disabled={live}>{live ? "Hold to talk — unavailable in Live mode" : "Hold to talk"}</option>
          <option value="toggle">Press to start, press again to stop</option>
          <option value="doubleTap">Double-tap right Shift</option>
        </Select>{live ? <small className="field-help">Live mode types as you speak, so the shortcut can’t stay held down — the held keys would turn each character into a shortcut.</small> : null}</Field>
        <Field label="Dictation shortcut" hint={settings.hotkey.mode === "doubleTap" ? "Not used with double-tap" : "Click Record, then press your keys"}>{shortcutRecorder("dictation", settings.hotkey.combo, settings.hotkey.mode === "doubleTap")}</Field>
        <Field label="Voice command shortcut" hint="Say an instruction like “make it shorter”">{shortcutRecorder("command", settings.commandHotkey)}</Field>
        {shortcutError ? <p className="field-error">{shortcutError}</p> : null}
      </div></Card>

      <Card><div className="setting-heading"><Sparkles /><div><h2>How your text appears</h2><p>Pick one. This is the main trade-off in Dictum.</p></div></div>
        <div className="mode-choice">
          <button type="button" className={`mode-option ${live ? "" : "selected"}`} onClick={() => chooseMode(false)} aria-pressed={!live}>
            <span className="mode-icon"><Sparkles size={18} /></span>
            <strong>Polished</strong>
            <p>Text appears when you stop speaking, cleaned up by AI.</p>
            <ul><li>AI formatting, voice snippets, dictionary</li><li>Works with every shortcut behavior</li><li>Waits until you finish</li></ul>
          </button>
          <button type="button" className={`mode-option ${live ? "selected" : ""}`} onClick={() => chooseMode(true)} aria-pressed={live}>
            <span className="mode-icon"><Zap size={18} /></span>
            <strong>Live</strong>
            <p>Words appear as you speak them, straight where you're typing.</p>
            <ul><li>No AI formatting, snippets, or dictionary</li><li>Needs a shortcut you don't hold down</li><li>No length limit on long dictations</li></ul>
          </button>
        </div>
        {modeNotice ? <p className="mode-notice"><Zap size={14} />{modeNotice}</p> : null}

        {live
          ? <div className="nested-settings form-grid">
              <Field label="Live service"><Select value={settings.realtime.provider} onChange={(e) => { const id = e.target.value; const next = realtimeProviders.find((item) => item.id === id); patch("realtime", { ...settings.realtime, provider: id, model: next?.models[0] || settings.realtime.model }); }}>{realtimeProviders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
              {modelField("Live model", settings.realtime.model, realtimeProviders.find((item) => item.id === settings.realtime.provider)?.models ?? [], (model) => patch("realtime", { ...settings.realtime, model }))}
            </div>
          : <>
              <Toggle checked={settings.formatting.enabled} onChange={(enabled) => patch("formatting", { ...settings.formatting, enabled })} label="Clean up my text with AI" description="Remove hesitations, fix grammar, and match the tone of the app you're writing in." />
              <div className="nested-settings">
                <Field label="Writing tone"><Select value={settings.formatting.tone} disabled={!settings.formatting.enabled} onChange={(e) => patch("formatting", { ...settings.formatting, tone: e.target.value as AppSettings["formatting"]["tone"] })}><option value="auto">Match the app I'm in</option><option value="formal">Formal</option><option value="casual">Casual</option><option value="code">Code-aware</option></Select></Field>
              </div>
              <Toggle checked={settings.formatting.removeFillers} onChange={(removeFillers) => patch("formatting", { ...settings.formatting, removeFillers })} label="Remove hesitations" description="Drop “um”, “uh”, and false starts without changing your meaning." disabled={!settings.formatting.enabled} />
              <Toggle checked={settings.formatting.fixGrammar} onChange={(fixGrammar) => patch("formatting", { ...settings.formatting, fixGrammar })} label="Fix grammar and self-corrections" description="Turn “Tuesday—no, Friday” into what you actually meant." disabled={!settings.formatting.enabled} />
              <Toggle checked={settings.snippetsVerbatim} onChange={(value) => patch("snippetsVerbatim", value)} label="Insert snippets exactly as written" description="When a voice snippet triggers, insert it word for word instead of letting AI reword it." />
            </>}
        <Toggle checked={settings.whisperMode} onChange={(value) => patch("whisperMode", value)} label="Boost quiet speech" description="Amplify and even out very soft speaking." />
      </Card>

      <Card><div className="setting-heading"><ShieldCheck /><div><h2>Privacy & history</h2><p>Audio is never saved to disk. Text history is optional.</p></div></div>
        <Toggle checked={settings.history.enabled} onChange={(enabled) => patch("history", { ...settings.history, enabled })} label="Keep a history of my dictations" description="Stored only on this computer: the text, which app you used, duration, and cost." />
        <div className="nested-settings"><Field label="Delete history after"><Select value={settings.history.retentionDays} onChange={(e) => patch("history", { ...settings.history, retentionDays: Number(e.target.value) })}><option value={1}>1 day</option><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>1 year</option></Select></Field></div>
        <Toggle checked={settings.zeroRetention} onChange={(value) => patch("zeroRetention", value)} label="Ask providers not to keep my audio" description="Sends the provider's privacy flag when they support one." />
        <Toggle checked={settings.autostart} onChange={(value) => patch("autostart", value)} label="Launch on startup" description="Start Dictum automatically when you turn on your PC and keep it ready in the system tray." />
      </Card>

      <Card className="advanced-card">
        <button type="button" className="advanced-toggle" onClick={() => setAdvancedOpen(!advancedOpen)} aria-expanded={advancedOpen}>
          <ChevronDown className={advancedOpen ? "open" : ""} size={18} />
          <div><h2>Advanced</h2><p>Custom models, backup service, self-hosted sync. Most people never need these.</p></div>
        </button>
        {advancedOpen ? <div className="advanced-body">
          <div className="form-grid">
            {modelField("Transcription model", settings.model, provider?.models ?? [], (model) => patch("model", model))}
            <Field label="Backup service" hint="Used only if your main service is unreachable"><Select value={settings.fallbackProvider || ""} onChange={(e) => patch("fallbackProvider", e.target.value || null)}><option value="">None</option>{providers.filter((item) => item.id !== settings.provider).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
            {settings.provider === "local" || settings.realtime.provider === "local" ? <Field label="Local server address" hint="Your own OpenAI-compatible server"><Input value={settings.localEndpoint} onChange={(e) => patch("localEndpoint", e.target.value)} /></Field> : null}
            {live ? null : modelField("AI clean-up model", settings.formatting.model, [settings.formatting.model], (model) => patch("formatting", { ...settings.formatting, model }))}
            <Field label="How text is inserted" hint="Switch only if text lands in the wrong place"><Select value={settings.injection} onChange={(e) => patch("injection", e.target.value as AppSettings["injection"])}><option value="clipboard">Paste (recommended)</option><option value="keystroke">Type it out character by character</option></Select></Field>
          </div>

          <div className="advanced-section"><h3>Encrypted sync to your own server</h3><p className="field-help">Copy settings, dictionary, and snippets between computers through a server you control. Your passphrase encrypts everything here and is never uploaded.</p>
            <Toggle checked={settings.sync.enabled} onChange={(enabled) => patch("sync", { ...settings.sync, enabled })} label="Enable sync" />
            <div className="form-grid nested-settings">
              <Field label="Server address"><Input disabled={!settings.sync.enabled} placeholder="https://cloud.example/dictum.enc" value={settings.sync.endpoint} onChange={(e) => patch("sync", { ...settings.sync, endpoint: e.target.value })} /></Field>
              <Field label="Username" hint="Only if your server requires a login"><Input disabled={!settings.sync.enabled} value={settings.sync.username} onChange={(e) => patch("sync", { ...settings.sync, username: e.target.value })} /></Field>
              <Field label="Server password" hint="Your server login, not the passphrase below"><Input disabled={!settings.sync.enabled} type="password" value={syncAuthPassword} onChange={(e) => setSyncAuthPassword(e.target.value)} /></Field>
              <Field label="Encryption passphrase" hint="At least 10 characters; never leaves this device"><Input disabled={!settings.sync.enabled} type="password" value={syncPassword} onChange={(e) => setSyncPassword(e.target.value)} /></Field>
              <div className="sync-buttons"><Button variant="secondary" disabled={!settings.sync.enabled || syncPassword.length < 10} onClick={() => void syncNow("pull")}>Download</Button><Button variant="secondary" disabled={!settings.sync.enabled || syncPassword.length < 10} onClick={() => void syncNow("push")}>Upload</Button></div>
              {syncStatus ? <span className="field-help">{syncStatus}</span> : null}
            </div>
          </div>

          <div className="advanced-section"><h3>Add another transcription service</h3><p className="field-help">Connect any OpenAI-compatible server without rebuilding Dictum.</p>
            <div className="plugin-form"><Input placeholder="short-id" value={plugin.id} onChange={(e) => setPlugin({ ...plugin, id: e.target.value })} /><Input placeholder="Display name" value={plugin.name} onChange={(e) => setPlugin({ ...plugin, name: e.target.value })} /><Input placeholder="https://api.example/v1" value={plugin.baseUrl} onChange={(e) => setPlugin({ ...plugin, baseUrl: e.target.value })} /><Input placeholder="Model name" value={plugin.model} onChange={(e) => setPlugin({ ...plugin, model: e.target.value })} /><Button variant="secondary" disabled={!plugin.id || !plugin.name || !plugin.baseUrl || !plugin.model} onClick={() => void addPlugin()}><Plus size={16} />Add service</Button>{pluginStatus ? <span className="field-help">{pluginStatus}</span> : null}</div>
          </div>
        </div> : null}
      </Card>
    </div>
  </div>;
}
