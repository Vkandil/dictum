import { AudioLines, BookOpenText, Clock3, Keyboard, Settings2 } from "lucide-react";

export type Page = "home" | "history" | "dictionary" | "shortcuts" | "settings";

const entries: { page: Page; label: string; icon: typeof AudioLines }[] = [
  { page: "home", label: "Dictation", icon: AudioLines },
  { page: "history", label: "History", icon: Clock3 },
  { page: "dictionary", label: "Dictionary", icon: BookOpenText },
  { page: "shortcuts", label: "Snippets", icon: Keyboard },
  { page: "settings", label: "Settings", icon: Settings2 },
];

export default function Sidebar({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark"><AudioLines size={20} /></div><span>Utter</span></div>
    <nav>{entries.map(({ page: item, label, icon: Icon }) => <button key={item} className={page === item ? "active" : ""} onClick={() => onNavigate(item)}><Icon size={18} /><span>{label}</span></button>)}</nav>
    <div className="sidebar-footer"><span className="privacy-dot" />Local-first · no telemetry</div>
  </aside>;
}
