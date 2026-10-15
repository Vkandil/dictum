import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, Pause, Trash2 } from "lucide-react";
import { deleteLocalModel, downloadLocalModel, importLocalModel, localHardware, isTauri, listLocalModels, listenModelProgress, pauseLocalModel, validateApiKey } from "../lib/bridge";
import { friendlyError, useI18n } from "../lib/i18n";
import type { DownloadProgress, ModelStatus } from "../lib/types";
import { Button } from "./Ui";
import { Field, Input, Select } from "./Ui";

export default function LocalModels({ selected, onSelect, compact = false, liveOnly = false, language, spokenLanguage = "auto" }: { selected: string; onSelect: (id: string) => void; compact?: boolean; liveOnly?: boolean; language?: string; spokenLanguage?: string }) {
  const { locale, t } = useI18n(language);
  const [models, setModels] = useState<ModelStatus[]>([]), [progress, setProgress] = useState<Record<string, DownloadProgress>>({}), [error, setError] = useState(""), [busy, setBusy] = useState("");
  const [hardware, setHardware] = useState({ ramGb: 0, cpuThreads: 1, modelDirectory: "" });
  const [importId, setImportId] = useState(liveOnly ? selected || "nemotron-streaming" : selected || "whisper-small"), [importPath, setImportPath] = useState("");
  useEffect(() => { void localHardware().then(setHardware).catch(() => undefined); }, []);
  const refresh = useCallback(async () => { try { setModels(await listLocalModels()); } catch (e) { setError(friendlyError(e, locale)); } }, [locale]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { let disposed = false; let off: (() => void) | undefined;
    void listenModelProgress(event => { setProgress(p => ({ ...p, [event.id]: event })); if (["installed", "paused"].includes(event.phase)) void refresh(); }).then(fn => { if (disposed) fn(); else off = fn; });
    return () => { disposed = true; off?.(); };
  }, [refresh]);
  const install = async (id: string) => {
    setError(""); setProgress(p => ({ ...p, [id]: { id, downloaded: models.find(m => m.model.id === id)?.downloaded ?? 0, total: models.find(m => m.model.id === id)?.model.size ?? 1, phase: "downloading" } }));
    try { await downloadLocalModel(id); if (!isTauri()) { setError(t("Downloads are available in the desktop app.", "Le téléchargement est disponible dans l’application de bureau.")); } }
    catch (e) { setError(friendlyError(e, locale)); }
    finally { setProgress(p => { const next = { ...p }; delete next[id]; return next; }); await refresh(); }
  };
  const use = async (id: string) => { setBusy(id); setError(""); try { await validateApiKey("offline", undefined, undefined, id); onSelect(id); } catch (e) { setError(friendlyError(e, locale)); } finally { setBusy(""); } };
  const remove = async (id: string) => { setError(""); try { await deleteLocalModel(id); await refresh(); } catch (e) { setError(friendlyError(e, locale)); } };
  const visible = models.filter(m => (!liveOnly || m.model.live) && (!compact || m.model.id === selected || ["whisper-base", "whisper-small", "whisper-turbo-q5"].includes(m.model.id)));
  return <div className="local-models">
    <p className="field-help">{t("No account or API bill. Internet is needed only for the download; dictation then works offline.", "Sans compte ni facturation d’API. Internet sert au téléchargement ; la dictée fonctionne ensuite hors ligne.")}</p>
    {hardware.ramGb ? <p className="field-help">{hardware.ramGb} GB RAM · {hardware.cpuThreads} {t("CPU threads", "threads CPU")} · {t("CPU inference; GPU builds are optional.", "Inférence CPU ; les versions GPU sont facultatives.")}</p> : null}
    {error ? <p role="alert" className="field-error">{error}</p> : null}
    {!models.length ? <p role="status">{t("Loading models…", "Chargement des modèles…")}</p> : null}
    <div className="model-grid">{visible.map(({ model, installed, downloaded, downloading }) => {
      const p = progress[model.id], running = downloading || !!p && !["paused", "installed"].includes(p.phase);
      const supported = spokenLanguage === "auto" || model.languages.includes(spokenLanguage);
      const phase = p?.phase === "verifying" ? t("Verifying…", "Vérification…") : p?.phase === "installing" ? t("Installing…", "Installation…") : t("Downloading…", "Téléchargement…");
      return <article key={model.id} className={`model-card ${selected === model.id ? "selected" : ""}`}>
        <div className="model-card-heading"><strong>{model.name}</strong>{model.id === "whisper-small" ? <span className="badge">{t("Balanced", "Équilibré")}</span> : null}</div>
        <p>{new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(model.size / 1_000_000)} MB · {t("Memory estimate", "Mémoire estimée")} {model.ramGb} GB</p>
        {hardware.ramGb && model.ramGb >= hardware.ramGb ? <p className="field-help">{t("This model may exceed your available memory. Choose a lighter model.", "Ce modèle peut dépasser votre mémoire disponible. Privilégiez un modèle plus léger.")}</p> : null}
        <div className="model-badges"><span>{model.license}</span><span>{model.languages.includes("fr") ? t("French + more", "Français et autres") : t("English", "Anglais")}</span>{model.live ? <span>Live</span> : null}</div>
        {!supported ? <p className="field-help">{t("This model does not support the selected spoken language.", "Ce modèle ne prend pas en charge la langue parlée sélectionnée.")}</p> : null}
        {running ? <><label>{phase}<progress aria-label={`${model.name} ${t("download", "téléchargement")}`} max={p?.total ?? model.size} value={p?.downloaded ?? downloaded} /></label><Button variant="secondary" onClick={() => void pauseLocalModel(model.id)}><Pause size={14} />{t("Pause", "Pause")}</Button></> : installed ? <div className="model-actions"><Button busy={busy === model.id} disabled={!supported} onClick={() => void use(model.id)}>{selected === model.id ? <CheckCircle2 size={14} /> : null}{selected === model.id ? t("Selected", "Sélectionné") : t("Use this model", "Utiliser ce modèle")}</Button>{selected !== model.id ? <button className="icon-button" aria-label={`${t("Remove", "Supprimer")} ${model.name}`} onClick={() => void remove(model.id)}><Trash2 size={15} /></button> : null}</div> : <Button variant="secondary" disabled={!supported} onClick={() => void install(model.id)}><Download size={14} />{downloaded ? t("Resume download", "Reprendre") : t("Download", "Télécharger")}</Button>}
      </article>;
    })}</div>
    {!compact ? <details className="model-import"><summary>{t("Advanced: import a downloaded model", "Avancé : importer un modèle téléchargé")}</summary><p className="field-help">{t("Use the original file listed in this catalogue: a Whisper GGML .bin or a Sherpa .tar.bz2 package. Its size and SHA-256 are verified before installation. Other formats can be served through My server.", "Utilisez le fichier original du catalogue : Whisper GGML .bin ou archive Sherpa .tar.bz2. La taille et le SHA-256 sont vérifiés avant installation. Les autres formats passent par Mon serveur.")}</p><Field label={t("Model", "Modèle")}><Select value={importId} onChange={e => setImportId(e.target.value)}>{models.map(m => <option key={m.model.id} value={m.model.id}>{m.model.name}</option>)}</Select></Field><Field label={t("Downloaded file path", "Chemin du fichier téléchargé")}><Input value={importPath} placeholder="C:\Models\ggml-small.bin" onChange={e => setImportPath(e.target.value)} /></Field><Button variant="secondary" busy={busy === "import"} disabled={!isTauri() || !importPath} onClick={async () => { setBusy("import"); setError(""); try { await importLocalModel(importId, importPath); await refresh(); setImportPath(""); } catch(e) { setError(friendlyError(e, locale)); } finally { setBusy(""); } }}>{t("Verify and import", "Vérifier et importer")}</Button>{hardware.modelDirectory ? <p className="field-help">{t("Model storage", "Dossier des modèles")} : <code>{hardware.modelDirectory}</code></p> : null}</details> : null}
  </div>;
}
