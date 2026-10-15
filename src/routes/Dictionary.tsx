import { useI18n } from "../lib/i18n";
import { useState } from "react";
import { BookOpenText, Plus, Trash2 } from "lucide-react";
import { addDictionaryTerm, removeDictionaryTerm } from "../lib/bridge";
import type { DictionaryTerm } from "../lib/types";
import { Button, Card, EmptyState, Input } from "../components/Ui";
import LiveModeNotice from "../components/LiveModeNotice";

export default function Dictionary({ terms, reload, liveMode }: { terms: DictionaryTerm[]; reload: () => Promise<void>; liveMode: boolean }) {
  const { t } = useI18n();
  const [term, setTerm] = useState("");
  const add = async () => { const clean = term.trim(); if (!clean) return; await addDictionaryTerm(clean); setTerm(""); await reload(); };
  return <div className="page">
    <header className="page-header compact"><div><p className="eyebrow">{t("Personal vocabulary", "Vocabulaire personnel")}</p><h1>{t("Dictionary", "Dictionnaire")}</h1><p>{t("Names, acronyms, and jargon are sent as context—not as analytics.", "Les noms, acronymes et termes sont envoyés comme contexte au fournisseur sélectionné.")}</p></div></header>
    {liveMode ? <p className="field-help">{t("Live vocabulary hints depend on the selected provider.", "Les indications de vocabulaire en direct dépendent du fournisseur choisi.")}</p> : null}
    <Card className="inline-form"><Input placeholder={t("Add a word or phrase, e.g. Voxtral", "Ajouter un mot ou une expression, par exemple Voxtral")} value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void add(); }} /><Button onClick={() => void add()}><Plus size={16} />{t("Add term", "Ajouter")}</Button></Card>
    {!terms.length ? <Card><EmptyState icon={<BookOpenText />} title={t("Teach Dictum your vocabulary", "Apprenez votre vocabulaire à Dictum")} body={t("Add people, products, places, and technical terms to improve recognition.", "Ajoutez des noms, produits, lieux et termes techniques pour améliorer la reconnaissance.")} /></Card> : <Card className="term-list">{terms.map((item) => <div className="term" key={item.id}><div><strong>{item.term}</strong><span>{item.source === "auto" ? t("Learned", "Appris") : t("Added manually", "Ajouté manuellement")}</span></div><button title={t("Remove", "Supprimer")} onClick={async () => { await removeDictionaryTerm(item.id); await reload(); }}><Trash2 size={16} /></button></div>)}</Card>}
  </div>;
}
