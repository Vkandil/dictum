import { useState } from "react";
import { Keyboard, Plus, Trash2 } from "lucide-react";
import { removeSnippet, saveSnippet } from "../lib/bridge";
import type { Snippet } from "../lib/types";
import { Button, Card, EmptyState, Input } from "../components/Ui";
import LiveModeNotice from "../components/LiveModeNotice";

export default function Snippets({ snippets, reload, liveMode }: { snippets: Snippet[]; reload: () => Promise<void>; liveMode: boolean }) {
  const [trigger, setTrigger] = useState("");
  const [expansion, setExpansion] = useState("");
  const add = async () => { if (!trigger.trim() || !expansion.trim()) return; await saveSnippet(null, trigger.trim(), expansion.trim()); setTrigger(""); setExpansion(""); await reload(); };
  return <div className="page">
    <header className="page-header compact"><div><p className="eyebrow">Say less, type more</p><h1>Voice snippets</h1><p>Speak a short cue and insert a reusable block instantly.</p></div></header>
    {liveMode ? <LiveModeNotice feature="Voice snippets" /> : null}
    <Card className="snippet-form"><label><span>When I say</span><Input placeholder="my email" value={trigger} onChange={(e) => setTrigger(e.target.value)} /></label><label><span>Insert</span><textarea className="input" rows={3} placeholder="hello@example.com" value={expansion} onChange={(e) => setExpansion(e.target.value)} /></label><Button onClick={() => void add()}><Plus size={16} />Create snippet</Button></Card>
    {!snippets.length ? <Card><EmptyState icon={<Keyboard />} title="No voice snippets" body="Try “my email”, “meeting link”, or “standup” as your first cue." /></Card> : <div className="snippet-grid">{snippets.map((item) => <Card className="snippet" key={item.id}><div><span>Say</span><strong>“{item.trigger}”</strong></div><p>{item.expansion}</p><button title="Remove" onClick={async () => { await removeSnippet(item.id); await reload(); }}><Trash2 size={16} /></button></Card>)}</div>}
  </div>;
}
