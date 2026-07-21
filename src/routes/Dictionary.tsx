import { useState } from "react";
import { BookOpenText, Plus, Trash2 } from "lucide-react";
import { addDictionaryTerm, removeDictionaryTerm } from "../lib/bridge";
import type { DictionaryTerm } from "../lib/types";
import { Button, Card, EmptyState, Input } from "../components/Ui";

export default function Dictionary({ terms, reload }: { terms: DictionaryTerm[]; reload: () => Promise<void> }) {
  const [term, setTerm] = useState("");
  const add = async () => { const clean = term.trim(); if (!clean) return; await addDictionaryTerm(clean); setTerm(""); await reload(); };
  return <div className="page">
    <header className="page-header compact"><div><p className="eyebrow">Personal vocabulary</p><h1>Dictionary</h1><p>Names, acronyms, and jargon are sent as context—not as analytics.</p></div></header>
    <Card className="inline-form"><Input placeholder="Add a word or phrase, e.g. Voxtral" value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void add(); }} /><Button onClick={() => void add()}><Plus size={16} />Add term</Button></Card>
    {!terms.length ? <Card><EmptyState icon={<BookOpenText />} title="Teach Utter your vocabulary" body="Add people, products, places, and technical terms to improve recognition." /></Card> : <Card className="term-list">{terms.map((item) => <div className="term" key={item.id}><div><strong>{item.term}</strong><span>{item.source === "auto" ? "Learned" : "Added manually"}</span></div><button title="Remove" onClick={async () => { await removeDictionaryTerm(item.id); await reload(); }}><Trash2 size={16} /></button></div>)}</Card>}
  </div>;
}
