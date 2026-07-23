import { useCallback, useEffect, useState } from "react";
import Sidebar, { type Page } from "./components/Sidebar";
import { bootstrap, listenDictation, listenSettingsNavigation, windowLabel } from "./lib/bridge";
import type { BootstrapData } from "./lib/types";
import Dictionary from "./routes/Dictionary";
import History from "./routes/History";
import Home from "./routes/Home";
import Onboarding from "./routes/Onboarding";
import Overlay from "./routes/Overlay";
import Settings from "./routes/Settings";
import Snippets from "./routes/Snippets";
import dictumLogo from "../logos/Dictum_png.png";

export default function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>(() => {
    const preview = new URLSearchParams(location.search).get("preview");
    return (["home", "history", "dictionary", "shortcuts", "settings"] as Page[]).includes(preview as Page) ? preview as Page : "home";
  });
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(async () => {
    setError(null);
    try {
      // Never let a slow or wedged backend leave the app stuck on the loader forever:
      // bail out after 15s and show an actionable error with a retry button instead.
      const result = await Promise.race([
        bootstrap(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Dictum took too long to start. A microphone driver or the app data may be unavailable.")), 15000)),
      ]);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { let off: (() => void) | undefined; listenDictation((state) => { if (state.phase === "result") setRefresh((v) => v + 1); }).then((fn) => off = fn); return () => off?.(); }, []);
  useEffect(() => { let off: (() => void) | undefined; listenSettingsNavigation(() => setPage("settings")).then((fn) => off = fn); return () => off?.(); }, []);
  if (windowLabel() === "overlay") return <Overlay />;
  if (!data && error) return <div className="app-loader"><div className="app-error">
    <div className="brand-mark"><img src={dictumLogo} alt="Dictum" /></div>
    <h1>Dictum couldn't start</h1>
    <p>{error}</p>
    <button className="app-error-retry" onClick={() => void reload()}>Retry</button>
  </div></div>;
  if (!data) return <div className="app-loader"><div className="brand-mark pulse"><img src={dictumLogo} alt="Dictum" /></div></div>;
  const previewDashboard = !windowLabel().startsWith("main") ? false : !('__TAURI_INTERNALS__' in window) && new URLSearchParams(location.search).has("preview");
  if (!data.settings.onboardingComplete && !previewDashboard) return <Onboarding initial={data.settings} devices={data.devices} hasOpenRouterKey={Boolean(data.hasApiKey.openrouter)} onComplete={reload} />;
  return <div className="shell"><Sidebar page={page} onNavigate={setPage} /><main className="content">
    {page === "home" ? <Home settings={data.settings} /> : null}
    {page === "history" ? <History refreshToken={refresh} onDictionaryChanged={reload} /> : null}
    {page === "dictionary" ? <Dictionary terms={data.dictionary} reload={reload} /> : null}
    {page === "shortcuts" ? <Snippets snippets={data.snippets} reload={reload} /> : null}
    {page === "settings" ? <Settings key={JSON.stringify(data.settings)} initial={data.settings} providers={data.providers} devices={data.devices} onSaved={reload} /> : null}
  </main></div>;
}
