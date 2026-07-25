import { useEffect, useState } from "react";
import { Check, Clipboard, Clock3, Pencil, Search, Trash2 } from "lucide-react";
import { Button, Card, EmptyState, Input } from "../components/Ui";
import { copyText, deleteHistory, getHistory, learnCorrection } from "../lib/bridge";
import type { HistoryItem } from "../lib/types";

export default function History({ refreshToken = 0, onDictionaryChanged }: { refreshToken?: number; onDictionaryChanged?: () => Promise<void> }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [correction, setCorrection] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const copy = async (item: HistoryItem) => {
    await copyText(item.text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 1500);
  };
  const load = (query = search) => getHistory(query).then(setItems);
  useEffect(() => { void load(); }, [refreshToken]);
  useEffect(() => { const timer = setTimeout(() => void load(search), 180); return () => clearTimeout(timer); }, [search]);
  const total = items.reduce((sum, item) => sum + item.costUsd, 0);
  return <div className="page">
    <header className="page-header compact"><div><p className="eyebrow">Your words stay yours</p><h1>History</h1><p>Search, copy, or remove locally stored dictations.</p></div><div className="header-actions"><div className="search-box"><Search size={17} /><Input aria-label="Search history" placeholder="Search dictations" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Button variant="danger" disabled={!items.length} onClick={async () => { await deleteHistory(); await load(); }}><Trash2 size={16} />Clear</Button></div></header>
    <div className="history-summary"><span>{items.length} dictations</span><span>{Math.round(items.reduce((s, i) => s + i.audioMs, 0) / 60000)} min spoken</span><span>${total.toFixed(4)} actual / estimated</span></div>
    {!items.length ? <Card><EmptyState icon={<Clock3 />} title="No dictations yet" body="Anything you dictate will appear here unless history is disabled." /></Card> : <div className="history-list">{items.map((item) => <Card key={item.id} className="history-item"><div className="history-meta"><span>{new Date(item.createdAt * 1000).toLocaleString()}</span><span>{item.appBundle || "Unknown app"}</span><span>{(item.audioMs / 1000).toFixed(1)}s</span></div>{editing === item.id ? <div className="correction-form"><textarea className="input" value={correction} onChange={(e) => setCorrection(e.target.value)} /><Button onClick={async () => { await learnCorrection(item.text, correction); setEditing(null); await onDictionaryChanged?.(); }}>Learn words</Button></div> : <p>{item.text}</p>}<div className="history-actions"><span>{item.model} · ${item.costUsd.toFixed(5)}</span><button title="Teach Dictum a correction" onClick={() => { setEditing(item.id); setCorrection(item.text); }}><Pencil size={16} /></button><button title={copiedId === item.id ? "Copied" : "Copy"} className={copiedId === item.id ? "copied" : ""} onClick={() => void copy(item)}>{copiedId === item.id ? <Check size={16} /> : <Clipboard size={16} />}</button><button title="Delete" onClick={async () => { await deleteHistory(item.id); await load(); }}><Trash2 size={16} /></button></div></Card>)}</div>}
  </div>;
}
