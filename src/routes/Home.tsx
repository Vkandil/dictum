import { onDevice } from "../lib/providers";
import { useI18n, friendlyError } from "../lib/i18n";
import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AudioLines, Mic, ShieldCheck, Sparkles, Square } from "lucide-react";
import { checkHotkey, getHistory, saveSettings, startRecording, stopRecording, listenDictation } from "../lib/bridge";
import { displayShortcut, friendlyShortcutError, shortcutFromKeyEvent } from "../lib/hotkey";
import type { AppSettings, DictationState, HistoryItem, ProviderManifest } from "../lib/types";
import { Card, Pill } from "../components/Ui";

export default function Home({ settings, providers, onSaved }: { settings: AppSettings; providers: ProviderManifest[]; onSaved: () => Promise<void> }) {
  const { locale, t } = useI18n();
  const [actionError,setActionError]=useState("");
  const [state, setState] = useState<DictationState>({ phase: "idle" });
  const [latest, setLatest] = useState<HistoryItem | undefined>();
  const [capturing, setCapturing] = useState<"dictation" | "command" | null>(null);
  const [shortcutError, setShortcutError] = useState("");
  useEffect(() => { void getHistory().then((items) => setLatest(items[0])); let off: (() => void) | undefined; listenDictation((next) => { setState(next); if (next.phase === "result") void getHistory().then((items) => setLatest(items[0])); }).then((fn) => off = fn); return () => off?.(); }, []);
  const activeProvider = providers.find(p => p.id === (settings.realtime.enabled ? settings.realtime.provider : settings.provider));
  const local = onDevice(activeProvider, settings.providerEndpoints[activeProvider?.id ?? ""] ?? (activeProvider?.id === "local" ? settings.localEndpoint : undefined));
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
      <output className="shortcut-display">{disabled ? t("Right Shift twice", "Deux appuis sur Maj droite") : displayShortcut(value)}</output>
      <button type="button" className={`shortcut-record ${capturing === target ? "capturing" : ""}`} disabled={disabled} onClick={() => { setCapturing(target); setShortcutError(""); }} onKeyDown={(event) => void captureShortcut(target, event)}>{capturing === target ? t("Press keys…", "Appuyez sur vos touches…") : t("Change", "Changer")}</button>
    </div>;
  return <div className="page home-page">
    <header className="page-header"><div><p className="eyebrow">{t("Ready when you are", "Prêt à vous suivre")}</p><h1>{t("Speak naturally.", "Parlez naturellement.")}<br />{t("Write beautifully.", "Écrivez simplement.")}</h1><p>{t("Hold your shortcut, talk, and Dictum types polished text wherever your cursor is.", "Activez votre raccourci et parlez. Dictum écrit là où se trouve votre curseur.")}</p></div><Pill tone={settings.setupVerified ? "success" : "warning"}>{settings.setupVerified ? t("Ready", "Prêt") : t("Setup incomplete", "Configuration incomplète")}</Pill></header>
    <Card className={`dictation-card ${active ? "recording" : ""}`}>
      <button className="record-button" aria-label={active ? t("Stop dictation", "Arrêter la dictée") : t("Start dictation", "Démarrer la dictée")} disabled={!settings.setupVerified} onClick={async () => { setActionError(""); try { await (active ? stopRecording() : startRecording(false)); } catch(e) {setActionError(friendlyError(e,locale));} }}>{active ? <Square size={28} fill="currentColor" /> : <Mic size={34} />}</button>
      <div><h2>{active ? t("Listening…", "À l’écoute…") : t("Start a dictation", "Démarrer une dictée")}</h2><p>{active ? t("Release the shortcut or tap stop when you’re done.", "Relâchez le raccourci ou arrêtez la dictée lorsque vous avez terminé.") : <>{doubleTap ? t("Double-tap right Shift", "Deux appuis sur Maj droite") : <>{settings.hotkey.mode === "hold" ? t("Hold", "Maintenez") : t("Press", "Appuyez sur")} <kbd>{hotkey}</kbd></>} {t("from any app", "depuis toute application")}</>}</p></div>
      {active ? <div className="big-wave">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ animationDelay: `${i * -45}ms` }} />)}</div> : null}
    </Card>
    {actionError ? <p role="alert" className="field-error">{actionError}</p> : null}
    <div className="metric-grid">
      <Card><div className="metric-icon green"><Sparkles size={19} /></div><span>{t("Formatting", "Nettoyage")}</span><strong>{settings.formatting.enabled ? t("Smart polish on", "Nettoyage IA activé") : t("Raw transcript", "Transcription brute")}</strong></Card>
      <Card><div className="metric-icon orange"><AudioLines size={19} /></div><span>{t("Provider", "Fournisseur")}</span><strong>{activeProvider?.name ?? settings.provider}</strong></Card>
      <Card><div className="metric-icon violet"><ShieldCheck size={19} /></div><span>{t("Privacy", "Confidentialité")}</span><strong>{local ? t("Local audio", "Audio local") : t("Online audio", "Audio en ligne")}</strong></Card>
    </div>
    <div className="two-column">
      <Card><div className="section-title"><div><p className="eyebrow">{t("Last dictation", "Dernière dictée")}</p><h2>{latest ? new Date(latest.createdAt * 1000).toLocaleString() : t("Nothing yet", "Aucune dictée")}</h2></div>{latest?.costKnown ? <Pill>${latest.costUsd.toFixed(5)}</Pill> : null}</div><p className="latest-text">{latest?.text || t("Your latest dictation will appear here after it is inserted.", "Votre dernière dictée apparaîtra ici après son insertion.")}</p></Card>
      <Card className="shortcuts-card"><div className="section-title"><div><p className="eyebrow">{t("Your shortcuts", "Vos raccourcis")}</p><h2>{t("Press these from any app", "Disponibles dans toutes vos applications")}</h2></div></div>
        <div className="home-shortcut"><div><strong>{t("Dictate", "Dicter")}</strong><span>{doubleTap ? t("Double-tap right Shift, speak, tap again", "Deux appuis sur Maj droite, puis deux pour arrêter") : settings.hotkey.mode === "hold" ? t("Hold it down while you speak", "Maintenir pendant que vous parlez") : t("Press to start, press again to stop", "Appuyer pour démarrer, puis pour arrêter")}</span></div>{recorder("dictation", settings.hotkey.combo, doubleTap)}</div>
        <div className="home-shortcut"><div><strong>{t("Edit what you just wrote", "Modifier votre dernier texte")}</strong><span>{t("Speak an instruction instead of text — “make it shorter”, “translate to French”, “turn it into bullets”.", "Dites une instruction : « raccourcir », « traduire en français » ou « faire une liste ».")}</span></div>{recorder("command", settings.commandHotkey)}</div>
        {shortcutError ? <p className="field-error">{shortcutError}</p> : null}
      </Card>
    </div>
  </div>;
}
