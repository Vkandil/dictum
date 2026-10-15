import { useEffect, useState } from "react";
import { saveApiKey, validateApiKey } from "../lib/bridge";
import { friendlyError, useI18n } from "../lib/i18n";
import type { AppSettings, ProviderManifest } from "../lib/types";
import { Button, Field, Input } from "./Ui";
import LocalModels from "./LocalModels";

export default function LiveConnection({ settings, provider, apiKeyHints, onChange }: { settings: AppSettings; provider?: ProviderManifest; apiKeyHints: Record<string, string>; onChange: (settings: AppSettings) => void }) {
  const { locale, t } = useI18n(settings.uiLanguage);
  const [key, setKey] = useState(""), [secret, setSecret] = useState(""), [token, setToken] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  useEffect(() => { setKey(""); setSecret(""); setToken(""); setNotice(""); }, [provider?.id]);
  if (!provider) return null;
  if (provider.protocol === "native") return <LocalModels liveOnly selected={settings.realtime.model} language={settings.uiLanguage} spokenLanguage={settings.language} onSelect={model => onChange({ ...settings, realtime: { ...settings.realtime, model } })} />;
  const endpoint = settings.providerEndpoints[provider.id] ?? (provider.id === "local" ? settings.localEndpoint : provider.baseUrl);
  const connect = async () => {
    setBusy(true); setNotice("");
    try {
      const credential = provider.auth === "aws" && key ? JSON.stringify({ accessKeyId: key, secretAccessKey: secret, sessionToken: token || undefined }) : key;
      await validateApiKey(provider.id, credential || undefined, endpoint, settings.realtime.model);
      if (credential) await saveApiKey(provider.id, credential);
      setKey(""); setSecret(""); setToken(""); setNotice(t("Connection saved. Your next live dictation will verify streaming access.", "Connexion enregistrée. La prochaine dictée vérifiera l’accès au temps réel."));
    } catch (e) { setNotice(friendlyError(e, locale)); } finally { setBusy(false); }
  };
  return <div className="live-connection">
    {provider.keyUrl ? <a className="text-link" href={provider.keyUrl} target="_blank" rel="noreferrer">{t("Get a key", "Obtenir une clé")} {provider.name} ↗</a> : null}
    {provider.requiresApiKey ? <Field label={`${provider.name} ${t("live API key", "clé pour le temps réel")}`} hint={apiKeyHints[provider.id] ? t("Leave empty to reuse the saved key.", "Laissez vide pour réutiliser la clé enregistrée.") : undefined}><Input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} /></Field> : null}
    {provider.auth === "aws" && key ? <><Field label={t("Secret access key", "Clé secrète")}><Input type="password" value={secret} onChange={e => setSecret(e.target.value)} /></Field><Field label={t("Session token", "Jeton de session")}><Input type="password" value={token} onChange={e => setToken(e.target.value)} /></Field></> : null}
    {provider.endpointRequired || provider.id === "local" ? <Field label={t("Server address", "Adresse du serveur")}><Input value={endpoint} onChange={e => onChange({ ...settings, providerEndpoints: { ...settings.providerEndpoints, [provider.id]: e.target.value } })} /></Field> : null}
    <Button variant="secondary" busy={busy} onClick={() => void connect()}>{t("Verify live connection", "Vérifier la connexion temps réel")}</Button>
    {notice ? <p role="status" className="field-help">{notice}</p> : null}
  </div>;
}
