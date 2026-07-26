import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AudioLines, Mic, ShieldCheck, Sparkles, Square } from "lucide-react";
import { checkHotkey, getHistory, saveSettings, startRecording, stopRecording, listenDictation } from "../lib/bridge";
import { displayShortcut, friendlyShortcutError, shortcutFromKeyEvent } from "../lib/hotkey";
import type { AppSettings, DictationState, HistoryItem } from "../lib/types";
import { Card, Pill } from "../components/Ui";

export default function Home({ settings, onSaved }: { settings: AppSettings; onSaved: () => Promise<void> }) {
  const [state, setState] = useState<DictationState>({ phase: "idle" });
  const [latest, setLatest] = useState<HistoryItem | undefined>();
  const [capturing, setCapturing] = useState<"dictation" | "command" | null>(null);
  const [shortcutError, setShortcutError] = useState("");
  useEffect(() => { void getHistory().then((items) => setLatest(items[0])); let off: (() => void) | undefined; listenDictation((next) => { setState(next); if (next.phase === "result") void getHistory().then((items) => setLatest(items[0])); }).then((fn) => off = fn); return () => off?.(); }, []);
  const active = state.phase === "listening";
  const hotkey = settings.hotkey.combo.replace("CommandOrControl", "Ctrl").replaceAll("+", " + ");
  const doubleTap = settings.hotkey.mode === "doubleTap";

  // Recording a shortcut here saves immediately - there's no Save button on this page, and a
  // shortcut the user just pressed but that never took effect would be worse than no control.
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
      await saveSettings(target === "dictation"
        ? { ...settings, hotkey: { ...settings.hotkey, combo: captured.combo } }
        : { ...settings, commandHotkey: captured.combo });
      await onSaved();
    } catch (error) {
      setShortcutError(friendlyShortcutError(error));
    }
  };

  const recorder = (target: "dictation" | "command", value: string, disabled?: boolean) =>
    <div className="shortcut-capture-row">
      <output className="shortcut-display">{disabled ? "Right Shift twice" : displayShortcut(value)}</output>
      <button type="button" className={`shortcut-record ${capturing === target ? "capturing" : ""}`} disabled={disabled} onClick={() => { setCapturing(target); setShortcutError(""); }} onKeyDown={(event) => void captureShortcut(target, event)}>{capturing === target ? "Press keys…" : "Change"}</button>
    </div>;
  return <div className="page home-page">
    <header className="page-header"><div><p className="eyebrow">Ready when you are</p><h1>Speak naturally.<br />Write beautifully.</h1><p>Hold your shortcut, talk, and Dictum types polished text wherever your cursor is.</p></div><Pill tone="success">System active</Pill></header>
    <Card className={`dictation-card ${active ? "recording" : ""}`}>
      <button className="record-button" onClick={() => void (active ? stopRecording() : startRecording(false))}>{active ? <Square size={28} fill="currentColor" /> : <Mic size={34} />}</button>
      <div><h2>{active ? "Listening…" : "Start a dictation"}</h2><p>{active ? "Release the shortcut or tap stop when you’re done." : <>Hold <kbd>{hotkey}</kbd> from any app</>}</p></div>
      {active ? <div className="big-wave">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ animationDelay: `${i * -45}ms` }} />)}</div> : null}
    </Card>
    <div className="metric-grid">
      <Card><div className="metric-icon green"><Sparkles size={19} /></div><span>Formatting</span><strong>{settings.formatting.enabled ? "Smart polish on" : "Raw transcript"}</strong></Card>
      <Card><div className="metric-icon orange"><AudioLines size={19} /></div><span>Provider</span><strong>{settings.provider === "openrouter" ? "OpenRouter" : settings.provider}</strong></Card>
      <Card><div className="metric-icon violet"><ShieldCheck size={19} /></div><span>Privacy</span><strong>{settings.provider === "local" ? "100% offline" : "Audio only"}</strong></Card>
    </div>
    <div className="two-column">
      <Card><div className="section-title"><div><p className="eyebrow">Last dictation</p><h2>{latest ? new Date(latest.createdAt * 1000).toLocaleString() : "Nothing yet"}</h2></div>{latest ? <Pill>${latest.costUsd.toFixed(5)}</Pill> : null}</div><p className="latest-text">{latest?.text || "Your latest dictation will appear here after it is inserted."}</p></Card>
      <Card className="shortcuts-card"><div className="section-title"><div><p className="eyebrow">Your shortcuts</p><h2>Press these from any app</h2></div></div>
        <div className="home-shortcut"><div><strong>Dictate</strong><span>{doubleTap ? "Double-tap right Shift, speak, tap again" : settings.hotkey.mode === "hold" ? "Hold it down while you speak" : "Press to start, press again to stop"}</span></div>{recorder("dictation", settings.hotkey.combo, doubleTap)}</div>
        <div className="home-shortcut"><div><strong>Edit what you just wrote</strong><span>Speak an instruction instead of text — “make it shorter”, “translate to French”, “turn it into bullets”.</span></div>{recorder("command", settings.commandHotkey)}</div>
        {shortcutError ? <p className="field-error">{shortcutError}</p> : null}
      </Card>
    </div>
  </div>;
}
