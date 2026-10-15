import LiveConnection from "../components/LiveConnection";
import FormatterConnection from "../components/FormatterConnection";
import ConnectionPanel from "../components/ConnectionPanel";
import { useI18n } from "../lib/i18n";
import { liveModels } from "../lib/providers";
import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { CheckCircle2, CloudCog, ChevronDown, Mic, Save, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button, Card, Field, Input, Select, Toggle } from "../components/Ui";
import MicTest from "../components/MicTest";
import { checkHotkey, runSync, saveSettings } from "../lib/bridge";
import { displayShortcut, friendlyShortcutError, shortcutFromKeyEvent } from "../lib/hotkey";
import type { AppSettings, AudioDevice, ProviderManifest } from "../lib/types";

const LANGUAGES = [["auto", "Auto-detect / code-switch"], ["en", "English"], ["fr", "Français"], ["es", "Español"], ["de", "Deutsch"], ["it", "Italiano"], ["pt", "Português"], ["nl", "Nederlands"], ["ar", "العربية"], ["hi", "हिन्दी"], ["ja", "日本語"], ["zh", "中文"]];
const CUSTOM_MODEL = "__custom__";

/** Shortcut behaviors that don't keep a key held while you speak - the only ones live
 *  transcription can work with, since held modifiers turn typed characters into shortcuts. */
const LIVE_SAFE_MODES = ["toggle", "doubleTap"];

export default function Settings({ initial, providers, devices, apiKeyHints, onSaved }: { initial: AppSettings; providers: ProviderManifest[]; devices: AudioDevice[]; apiKeyHints: Record<string, string>; onSaved: () => Promise<void> }) {
  const [settings, setSettings] = useState(initial);
  const { t } = useI18n(settings.uiLanguage);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [capturing, setCapturing] = useState<"dictation" | "command" | null>(null);
  const [shortcutError, setShortcutError] = useState("");
  const [modeNotice, setModeNotice] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [syncPassword, setSyncPassword] = useState("");
  const [syncAuthPassword, setSyncAuthPassword] = useState("");
  const [syncStatus, setSyncStatus] = useState("");

  const provider = useMemo(() => providers.find((item) => item.id === settings.provider), [providers, settings.provider]);
  const realtimeProviders = useMemo(() => providers.filter((item) => item.supportsRealtime), [providers]);
  const live = settings.realtime.enabled;
  // Keys belonging to services you're not currently using still matter - they're why switching
  // service can just work - so surface them instead of leaving the user wondering.

  const patch = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => { setSettings((current) => ({ ...current, [key]: value })); setDirty(true); };
  const save = async () => { setSaving(true); setSaveError(""); try { await checkHotkey(settings.hotkey.combo); await saveSettings(settings); setDirty(false); await onSaved(); } catch (error) { setSaveError(String(error)); } finally { setSaving(false); } };

  /** Switching to live mode also moves an incompatible shortcut behavior out of the way, so the
   *  invalid combination the backend rejects can never be assembled here in the first place. */
  const chooseMode = (nextLive: boolean) => {
    setSettings((current) => {
      const mustSwitch = nextLive && !LIVE_SAFE_MODES.includes(current.hotkey.mode);
      // Never change the user's shortcut behavior silently - say so, right where they can see
      // the control that changed.
      setModeNotice(mustSwitch ? t("Your shortcut is now press to start, press again to stop — live typing can't work while a key is held down.", "Votre raccourci fonctionne maintenant par appuis successifs. Le mode Live nécessite de relâcher les touches.") : "");
      return {
        ...current,
        realtime: { ...current.realtime, enabled: nextLive },
        hotkey: mustSwitch ? { ...current.hotkey, mode: "toggle" } : current.hotkey,
      };
    });
    setDirty(true);
  };

  // Same recorder the onboarding uses: press the real key combination instead of typing
  // shortcut syntax by hand. Availability is checked immediately so a conflicting combination
  // is rejected here rather than silently failing on save.
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
      if (target === "dictation") patch("hotkey", { ...settings.hotkey, combo: captured.combo });
      else patch("commandHotkey", captured.combo);
    } catch (error) {
      setShortcutError(friendlyShortcutError(error));
    }
  };

  const syncNow = async (direction: "push" | "pull") => { setSyncStatus(t("Syncing...", "Synchronisation...")); try { await runSync(direction, syncPassword, syncAuthPassword); setSyncStatus(direction === "push" ? t("Encrypted data uploaded.", "Données chiffrées envoyées.") : t("Encrypted data restored.", "Données chiffrées restaurées.")); if (direction === "pull") await onSaved(); } catch (error) { setSyncStatus(String(error)); } };

  const shortcutRecorder = (target: "dictation" | "command", value: string, disabled?: boolean) =>
    <div className="shortcut-capture-row">
      <output className="shortcut-display">{disabled ? t("Right Shift twice", "Deux appuis sur Maj droite") : displayShortcut(value)}</output>
      <button type="button" className={`shortcut-record ${capturing === target ? "capturing" : ""}`} disabled={disabled} onClick={() => { setCapturing(target); setShortcutError(""); }} onKeyDown={(event) => void captureShortcut(target, event)}>{capturing === target ? t("Press keys…", "Appuyez sur vos touches…") : t("Record", "Enregistrer")}</button>
    </div>;

  const modelField = (label: string, value: string, options: string[], onChange: (model: string) => void) => {
    const known = options.includes(value);
    return <Field label={label} hint={known ? undefined : t("Custom model", "Modèle personnalisé")}>
      <Select value={known ? value : CUSTOM_MODEL} onChange={(event) => onChange(event.target.value === CUSTOM_MODEL ? "" : event.target.value)}>
        {options.map((model) => <option key={model} value={model}>{model}</option>)}
        <option value={CUSTOM_MODEL}>{t("Custom…", "Personnalisé…")}</option>
      </Select>
      {known ? null : <Input value={value} placeholder={t("Enter a model name", "Nom du modèle")} onChange={(event) => onChange(event.target.value)} />}
    </Field>;
  };

  return <div className="page">
    <header className="page-header compact"><div><p className="eyebrow">{t("Make it yours", "À votre façon")}</p><h1>{t("Settings", "Réglages")}</h1><p>{t("Changes stay on this device. API keys live only in your OS keychain.", "Vos réglages restent sur cet appareil. Vos clés sont conservées dans le coffre de Windows.")}</p></div><div>{saveError ? <p className="field-error settings-error">{saveError}</p> : null}<Button variant={dirty ? "primary" : "secondary"} busy={saving} disabled={!dirty && !saving} onClick={() => void save()}>{dirty ? <><Save size={16} />{t("Save changes", "Enregistrer")}</> : <><CheckCircle2 size={16} />{t("Saved", "Enregistré")}</>}</Button></div></header>

    <div className="settings-stack">
      <Card><div className="setting-heading"><CloudCog /><div><h2>{t("Transcription", "Transcription")}</h2><p>{t("Choose a service, an installed model, or your own server.", "Choisissez un service, un mod\u00e8le install\u00e9 ou votre serveur.")}</p></div></div>
        <div className="form-grid"><Field label={t("Interface language", "Langue de l'interface")}><Select value={settings.uiLanguage} onChange={e => patch("uiLanguage", e.target.value as AppSettings["uiLanguage"])}><option value="auto">{t("System language", "Langue du syst\u00e8me")}</option><option value="en">English</option><option value="fr">{"Fran\u00e7ais"}</option></Select></Field><Field label={t("Spoken language", "Langue parl\u00e9e")}><Select value={settings.language} onChange={e => patch("language", e.target.value)}>{LANGUAGES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select></Field></div>
        <ConnectionPanel settings={settings} providers={providers} apiKeyHints={apiKeyHints} onChange={next => { setSettings(next); setDirty(true); }} />
      </Card>

      <Card><div className="setting-heading"><Mic /><div><h2>{t("Microphone & shortcut", "Microphone et raccourcis")}</h2><p>{t("How you start and stop dictating.", "Comment démarrer et arrêter la dictée.")}</p></div></div><div className="form-grid">
        <Field label={t("Microphone", t("Microphone", "Microphone"))}><Select value={settings.microphoneId || ""} onChange={(e) => patch("microphoneId", e.target.value || null)}><option value="">{t("System default", "Microphone du système")}</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select><MicTest deviceId={settings.microphoneId} /></Field>
        <Field label={t("How the shortcut works", "Fonctionnement du raccourci")}><Select value={settings.hotkey.mode} onChange={(e) => { patch("hotkey", { ...settings.hotkey, mode: e.target.value as AppSettings["hotkey"]["mode"] }); setCapturing(null); setModeNotice(""); }}>
          {/* Kept visible but disabled while Live is on: an option that silently disappears
              leaves people wondering whether they imagined it. Greyed out with the reason
              spelled out below explains the constraint instead of hiding it. */}
          <option value="hold" disabled={live}>{live ? t("Hold to talk — unavailable in Live mode", "Maintenir pour parler — indisponible en mode Live") : t("Hold to talk", "Maintenir pour parler")}</option>
          <option value="toggle">{t("Press to start, press again to stop", "Appuyer pour démarrer, puis pour arrêter")}</option>
          <option value="doubleTap">{t("Double-tap right Shift", "Appuyer deux fois sur Maj droite")}</option>
        </Select>{live ? <small className="field-help">{t("Live mode types as you speak, so the shortcut can’t stay held down — the held keys would turn each character into a shortcut.", "Le mode Live écrit pendant que vous parlez. Relâchez les touches pour éviter de déclencher d’autres raccourcis.")}</small> : null}</Field>
        <Field label={t("Dictation shortcut", "Raccourci de dictée")} hint={settings.hotkey.mode === "doubleTap" ? t("Not used with double-tap", "Inutilisé avec le double appui") : t("Click Record, then press your keys", "Cliquez sur Enregistrer, puis appuyez sur vos touches")}>{shortcutRecorder("dictation", settings.hotkey.combo, settings.hotkey.mode === "doubleTap")}</Field>
        <Field label={t("Voice command shortcut", "Raccourci de commande vocale")} hint={t("Say an instruction like “make it shorter”", "Dites une instruction, par exemple « raccourcir »")}>{shortcutRecorder("command", settings.commandHotkey)}</Field>
        {shortcutError ? <p className="field-error">{shortcutError}</p> : null}
      </div></Card>

      <Card><div className="setting-heading"><Sparkles /><div><h2>{t("How your text appears", "Comment votre texte apparaît")}</h2><p>{t("Pick one. This is the main trade-off in Dictum.", "Choisissez entre une dictée après votre phrase et une saisie en direct.")}</p></div></div>
        <div className="mode-choice">
          <button type="button" className={`mode-option ${live ? "" : "selected"}`} onClick={() => chooseMode(false)} aria-pressed={!live}>
            <span className="mode-icon"><Sparkles size={18} /></span>
            <strong>{t("Polished", "Après la dictée")}</strong>
            <p>{t("Text appears when you stop speaking. AI clean-up is optional.", "Le texte apparaît à la fin. Le nettoyage IA est facultatif.")}</p>
            <ul><li>{t("AI formatting, voice snippets, dictionary", "Nettoyage IA, extraits vocaux et dictionnaire")}</li><li>{t("Works with every shortcut behavior", "Compatible avec tous les raccourcis")}</li><li>{t("Waits until you finish", "Attend la fin de votre dictée")}</li></ul>
          </button>
          <button type="button" className={`mode-option ${live ? "selected" : ""}`} onClick={() => chooseMode(true)} aria-pressed={live}>
            <span className="mode-icon"><Zap size={18} /></span>
            <strong>Live</strong>
            <p>{t("Words appear as you speak them, straight where you're typing.", "Les mots apparaissent pendant que vous parlez, là où se trouve votre curseur.")}</p>
            <ul><li>{t("No AI formatting or snippets", "Sans nettoyage IA ni extraits vocaux")}</li><li>{t("Needs a shortcut you don't hold down", "Nécessite un raccourci sans maintien des touches")}</li><li>{t("No length limit on long dictations", "Permet les longues dictées")}</li></ul>
          </button>
        </div>
        {modeNotice ? <p className="mode-notice"><Zap size={14} />{modeNotice}</p> : null}

        {live
          ? <div className="nested-settings form-grid">
              <Field label={t("Live service", "Service temps réel")}><Select value={settings.realtime.provider} onChange={(e) => { const id = e.target.value; const next = realtimeProviders.find((item) => item.id === id); patch("realtime", { ...settings.realtime, provider: id, model: liveModels(next)[0]?.id || settings.realtime.model }); }}>{realtimeProviders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
              {modelField(t("Live model", "Modèle temps réel"), settings.realtime.model, liveModels(realtimeProviders.find((item) => item.id === settings.realtime.provider)).map(m => m.id), (model) => patch("realtime", { ...settings.realtime, model }))}
              <LiveConnection settings={settings} provider={realtimeProviders.find(p => p.id === settings.realtime.provider)} apiKeyHints={apiKeyHints} onChange={next => { setSettings(next); setDirty(true); }} />
            </div>
          : <>
              <Toggle disabled={settings.provider === "offline" && !settings.formatting.provider} checked={settings.formatting.enabled} onChange={(enabled) => patch("formatting", { ...settings.formatting, enabled })} label={t("Clean up my text with AI", "Nettoyer mon texte avec l’IA")} description={t("Remove hesitations, fix grammar, and match the tone of the app you're writing in.", "Retirer les hésitations, corriger la grammaire et adapter le ton à votre application.")} />
              <div className="nested-settings">
                <FormatterConnection settings={settings} providers={providers} apiKeyHints={apiKeyHints} onChange={next => { setSettings(next); setDirty(true); }} />
                <Field label={t("Writing tone", "Ton du texte")}><Select value={settings.formatting.tone} disabled={!settings.formatting.enabled} onChange={(e) => patch("formatting", { ...settings.formatting, tone: e.target.value as AppSettings["formatting"]["tone"] })}><option value="auto">{t("Match the app I'm in", "Adapter à mon application")}</option><option value="formal">{t("Formal", "Formel")}</option><option value="casual">{t("Casual", "Décontracté")}</option><option value="code">{t("Code-aware", "Adapté au code")}</option></Select></Field>
              </div>
              <Toggle checked={settings.formatting.removeFillers} onChange={(removeFillers) => patch("formatting", { ...settings.formatting, removeFillers })} label={t("Remove hesitations", "Retirer les hésitations")} description={t("Drop “um”, “uh”, and false starts without changing your meaning.", "Retirer les « euh » et faux départs sans changer le sens.")} disabled={!settings.formatting.enabled} />
              <Toggle checked={settings.formatting.fixGrammar} onChange={(fixGrammar) => patch("formatting", { ...settings.formatting, fixGrammar })} label={t("Fix grammar and self-corrections", "Corriger la grammaire et les reprises")} description={t("Turn “Tuesday—no, Friday” into what you actually meant.", "Transformer « mardi… non, vendredi » en « vendredi ».")} disabled={!settings.formatting.enabled} />
              <Toggle checked={settings.snippetsVerbatim} onChange={(value) => patch("snippetsVerbatim", value)} label={t("Insert snippets exactly as written", "Insérer les extraits mot pour mot")} description={t("When a voice snippet triggers, insert it word for word instead of letting AI reword it.", "Un extrait vocal conserve sa formulation d’origine.")} />
            </>}
        <Toggle checked={settings.whisperMode} onChange={(value) => patch("whisperMode", value)} label={t("Boost quiet speech", "Amplifier la voix faible")} description={t("Amplify and even out very soft speaking.", "Amplifier et équilibrer une voix très faible.")} />
      </Card>

      <Card><div className="setting-heading"><ShieldCheck /><div><h2>{t("Privacy & history", "Confidentialité et historique")}</h2><p>{t("Audio is never saved to disk. Text history is optional.", "L’audio des dictées n’est pas enregistré sur disque. L’historique des textes est facultatif.")}</p></div></div>
        <Toggle checked={settings.history.enabled} onChange={(enabled) => patch("history", { ...settings.history, enabled })} label={t("Keep a history of my dictations", "Conserver l’historique des dictées")} description={t("Stored only on this computer: the text, which app you used, duration, and cost.", "Conserver le texte, l’application, la durée et les coûts connus sur cet ordinateur.")} />
        <div className="nested-settings"><Field label={t("Delete history after", "Supprimer l’historique après")}><Select value={settings.history.retentionDays} onChange={(e) => patch("history", { ...settings.history, retentionDays: Number(e.target.value) })}><option value={1}>{t("1 day", "1 jour")}</option><option value={7}>{t("7 days", "7 jours")}</option><option value={30}>{t("30 days", "30 jours")}</option><option value={90}>{t("90 days", "90 jours")}</option><option value={365}>{t("1 year", "1 an")}</option></Select></Field></div>
        <Toggle checked={settings.zeroRetention} onChange={(value) => patch("zeroRetention", value)} label={t("Ask providers not to keep my audio", "Demander au fournisseur de ne pas conserver l’audio")} description={t("Sends the provider's privacy flag when they support one.", "Envoie le paramètre de confidentialité lorsqu’il existe. Les garanties dépendent du fournisseur et de votre contrat.")} />
        <Toggle checked={settings.autostart} onChange={(value) => patch("autostart", value)} label={t("Launch on startup", "Démarrer avec Windows")} description={t("Start Dictum automatically when you turn on your PC and keep it ready in the system tray.", "Garder Dictum disponible dans la zone de notification dès le démarrage.")} />
      </Card>

      <Card className="advanced-card">
        <button type="button" className="advanced-toggle" onClick={() => setAdvancedOpen(!advancedOpen)} aria-expanded={advancedOpen}>
          <ChevronDown className={advancedOpen ? "open" : ""} size={18} />
          <div><h2>{t("Advanced", "Avancé")}</h2><p>{t("Custom models, backup service, self-hosted sync. Most people never need these.", "Modèles personnalisés, service de secours et synchronisation sur votre serveur.")}</p></div>
        </button>
        {advancedOpen ? <div className="advanced-body">
          <div className="form-grid">
            {modelField(t("Transcription model", "Modèle de transcription"), settings.model, provider?.models ?? [], (model) => patch("model", model))}
            <Field label={t("Backup service", "Service de secours")} hint={t("Used only if your main service is unreachable", "Utilisé si le service principal est inaccessible")}><Select value={settings.fallbackProvider || ""} onChange={(e) => patch("fallbackProvider", e.target.value || null)}><option value="">{t("None", "Aucun")}</option>{providers.filter((item) => item.id !== settings.provider).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
            <Toggle checked={settings.allowCloudFallback} onChange={value => patch("allowCloudFallback", value)} label={t("Allow cloud backup for local dictation", "Autoriser un secours cloud pour la dictée locale")} description={t("If you configure a cloud backup, audio may leave this computer when local dictation fails.", "Avec un secours cloud configuré, l’audio peut quitter cet ordinateur si la dictée locale échoue.")} />
            {settings.provider === "local" || settings.realtime.provider === "local" ? <Field label={t("Local server address", "Adresse du serveur local")} hint={t("Your own OpenAI-compatible server", "Votre serveur compatible OpenAI")}><Input value={settings.localEndpoint} onChange={(e) => patch("localEndpoint", e.target.value)} /></Field> : null}
            {live ? null : modelField(t("AI clean-up model", "Modèle de nettoyage IA"), settings.formatting.model, [settings.formatting.model], (model) => patch("formatting", { ...settings.formatting, model }))}
            <Field label={t("How text is inserted", "Insertion du texte")} hint={t("Switch only if text lands in the wrong place", "À changer si l’insertion fonctionne mal")}><Select value={settings.injection} onChange={(e) => patch("injection", e.target.value as AppSettings["injection"])}><option value="clipboard">{t("Paste (recommended)", "Coller (recommandé)")}</option><option value="keystroke">{t("Type it out character by character", "Saisir caractère par caractère")}</option></Select></Field>
          </div>

          <div className="advanced-section"><h3>{t("Encrypted sync to your own server", "Synchronisation chiffrée sur votre serveur")}</h3><p className="field-help">{t("Copy settings, dictionary, and snippets between computers through a server you control. Your passphrase encrypts everything here and is never uploaded.", "Synchronisez vos réglages, dictionnaire et extraits avec votre serveur. La phrase secrète chiffre les données sur cet appareil et n’est jamais envoyée.")}</p>
            <Toggle checked={settings.sync.enabled} onChange={(enabled) => patch("sync", { ...settings.sync, enabled })} label={t("Enable sync", "Activer la synchronisation")} />
            <div className="form-grid nested-settings">
              <Field label={t("Server address", "Adresse du serveur")}><Input disabled={!settings.sync.enabled} placeholder="https://cloud.example/dictum.enc" value={settings.sync.endpoint} onChange={(e) => patch("sync", { ...settings.sync, endpoint: e.target.value })} /></Field>
              <Field label={t("Username", "Nom d’utilisateur")} hint={t("Only if your server requires a login", "Si votre serveur exige une connexion")}><Input disabled={!settings.sync.enabled} value={settings.sync.username} onChange={(e) => patch("sync", { ...settings.sync, username: e.target.value })} /></Field>
              <Field label={t("Server password", "Mot de passe du serveur")} hint={t("Your server login, not the passphrase below", "Le mot de passe du serveur")}><Input disabled={!settings.sync.enabled} type="password" value={syncAuthPassword} onChange={(e) => setSyncAuthPassword(e.target.value)} /></Field>
              <Field label={t("Encryption passphrase", "Phrase secrète de chiffrement")} hint={t("At least 10 characters; never leaves this device", "Au moins 10 caractères ; reste sur cet appareil")}><Input disabled={!settings.sync.enabled} type="password" value={syncPassword} onChange={(e) => setSyncPassword(e.target.value)} /></Field>
              <div className="sync-buttons"><Button variant="secondary" disabled={!settings.sync.enabled || syncPassword.length < 10} onClick={() => void syncNow("pull")}>{t("Download", "Télécharger")}</Button><Button variant="secondary" disabled={!settings.sync.enabled || syncPassword.length < 10} onClick={() => void syncNow("push")}>{t("Upload", "Envoyer")}</Button></div>
              {syncStatus ? <span className="field-help">{syncStatus}</span> : null}
            </div>
          </div>


        </div> : null}
      </Card>
    </div>
  </div>;
}
