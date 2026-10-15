import { useI18n } from "../lib/i18n";
import { AudioLines, BookOpenText, Clock3, Keyboard, Settings2 } from "lucide-react";
import dictumLogo from "../../logos/Dictum_png.png";

export type Page = "home" | "history" | "dictionary" | "shortcuts" | "settings";

const entries: { page: Page; label: string; icon: typeof AudioLines }[] = [
  { page: "home", label: "Dictation", icon: AudioLines },
  { page: "history", label: "History", icon: Clock3 },
  { page: "dictionary", label: "Dictionary", icon: BookOpenText },
  { page: "shortcuts", label: "Snippets", icon: Keyboard },
  { page: "settings", label: "Settings", icon: Settings2 },
];

export default function Sidebar({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  const { t } = useI18n();
  const labels: Record<Page, string> = { home: t("Dictation", "Dict\u00e9e"), history: t("History", "Historique"), dictionary: t("Dictionary", "Dictionnaire"), shortcuts: t("Snippets", "Extraits"), settings: t("Settings", "R\u00e9glages") };
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark"><img src={dictumLogo} alt="" /></div><span>Dictum</span></div>
    <nav>{entries.map(({ page: item, icon: Icon }) => <button key={item} className={page === item ? "active" : ""} onClick={() => onNavigate(item)}><Icon size={18} /><span>{labels[item]}</span></button>)}</nav>
    <div className="sidebar-footer"><span className="privacy-dot" />{t("Local-first · no telemetry", "Priorité au local · sans télémétrie")}</div>
  </aside>;
}
