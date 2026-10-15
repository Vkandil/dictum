import { useI18n } from "../lib/i18n";
import { useState } from "react";
import { Keyboard, Plus, Trash2 } from "lucide-react";
import { removeSnippet, saveSnippet } from "../lib/bridge";
import type { Snippet } from "../lib/types";
import { Button, Card, EmptyState, Input } from "../components/Ui";
import LiveModeNotice from "../components/LiveModeNotice";

export default function Snippets({ snippets, reload, liveMode }: { snippets: Snippet[]; reload: () => Promise<void>; liveMode: boolean }) {
  const { t } = useI18n();
  const [trigger, setTrigger] = useState("");
  const [expansion, setExpansion] = useState("");
  const add = async () => { if (!trigger.trim() || !expansion.trim()) return; await saveSnippet(null, trigger.trim(), expansion.trim()); setTrigger(""); setExpansion(""); await reload(); };
  return <div className="page">
    <header className="page-header compact"><div><p className="eyebrow">{t("Say less, type more", "Quelques mots suffisent")}</p><h1>{t("Voice snippets", "Extraits vocaux")}</h1><p>{t("Speak a short cue and insert a reusable block instantly.", "Dites une courte expression pour insérer un texte réutilisable.")}</p></div></header>
    {liveMode ? <LiveModeNotice feature={t("Voice snippets", "Extraits vocaux")} /> : null}
    <Card className="snippet-form"><label><span>{t("When I say", "Quand je dis")}</span><Input placeholder={t("my email", "mon email")} value={trigger} onChange={(e) => setTrigger(e.target.value)} /></label><label><span>{t("Insert", "Insérer")}</span><textarea className="input" rows={3} placeholder="hello@example.com" value={expansion} onChange={(e) => setExpansion(e.target.value)} /></label><Button onClick={() => void add()}><Plus size={16} />{t("Create snippet", "Créer l’extrait")}</Button></Card>
    {!snippets.length ? <Card><EmptyState icon={<Keyboard />} title={t("No voice snippets", "Aucun extrait vocal")} body={t("Try “my email”, “meeting link”, or “standup” as your first cue.", "Essayez « mon email » ou « lien de réunion » comme première expression.")} /></Card> : <div className="snippet-grid">{snippets.map((item) => <Card className="snippet" key={item.id}><div><span>{t("Say", "Dire")}</span><strong>“{item.trigger}”</strong></div><p>{item.expansion}</p><button title={t("Remove", "Supprimer")} onClick={async () => { await removeSnippet(item.id); await reload(); }}><Trash2 size={16} /></button></Card>)}</div>}
  </div>;
}
