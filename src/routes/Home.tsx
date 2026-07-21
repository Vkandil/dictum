import { useEffect, useState } from "react";
import { AudioLines, Command, Mic, ShieldCheck, Sparkles, Square } from "lucide-react";
import { getHistory, startRecording, stopRecording, listenDictation } from "../lib/bridge";
import type { AppSettings, DictationState, HistoryItem } from "../lib/types";
import { Card, Pill } from "../components/Ui";

export default function Home({ settings }: { settings: AppSettings }) {
  const [state, setState] = useState<DictationState>({ phase: "idle" });
  const [latest, setLatest] = useState<HistoryItem | undefined>();
  useEffect(() => { void getHistory().then((items) => setLatest(items[0])); let off: (() => void) | undefined; listenDictation((next) => { setState(next); if (next.phase === "result") void getHistory().then((items) => setLatest(items[0])); }).then((fn) => off = fn); return () => off?.(); }, []);
  const active = state.phase === "listening";
  const hotkey = settings.hotkey.combo.replace("CommandOrControl", navigator.platform.includes("Mac") ? "⌘" : "Ctrl").replaceAll("+", " + ");
  return <div className="page home-page">
    <header className="page-header"><div><p className="eyebrow">Ready when you are</p><h1>Speak naturally.<br />Write beautifully.</h1><p>Hold your shortcut, talk, and Utter types polished text wherever your cursor is.</p></div><Pill tone="success">System active</Pill></header>
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
      <Card className="command-card"><Command size={24} /><div><h2>Command mode</h2><p>Transform your last block by voice: “make it concise”, “translate to French”, or “turn it into bullets”.</p><kbd>{settings.commandHotkey.replace("CommandOrControl", navigator.platform.includes("Mac") ? "⌘" : "Ctrl").replaceAll("+", " + ")}</kbd></div></Card>
    </div>
  </div>;
}
