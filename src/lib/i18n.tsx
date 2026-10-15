import { createContext, useContext, useEffect, type ReactNode } from "react";
const Locale = createContext("auto");
export function resolveLocale(language = "auto") { return language === "auto" ? (navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en") : language; }
export function I18nProvider({ language, children }: { language: string; children: ReactNode }) {
  const locale = resolveLocale(language);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return <Locale.Provider value={locale}>{children}</Locale.Provider>;
}
export function useI18n(override?: string) {
  const current = useContext(Locale), locale = resolveLocale(override ?? current);
  return { locale, t: (english: string, french: string) => locale === "fr" ? french : english };
}
export function friendlyError(error: unknown, locale: string) {
  const message = String(error).replace(/^Error:\s*/, "");
  const t = (en: string, fr: string) => locale === "fr" ? fr : en;
  if (/credit|quota|payment|402/i.test(message)) return t("Your key was accepted, but inference credits or spending quota are missing. Add credits in your provider account, or choose a local model.", "Votre clé est reconnue, mais le compte manque de crédits ou de quota. Ajoutez des crédits chez le fournisseur ou choisissez un modèle local.");
  if (/key rejected|invalid.key|401|403/i.test(message)) return t("This key was rejected. Check the key, permissions and account region.", "Cette clé est refusée. Vérifiez la clé, ses permissions et la région du compte.");
  if (/no speech|empty_audio/i.test(message)) return t("No speech was detected. Check the microphone meter and speak closer to the microphone.", "Aucune parole détectée. Vérifiez le niveau du micro et rapprochez-vous.");
  if (/not enough.*space|disk space/i.test(message)) return t("Not enough disk space. Choose a smaller model or free some space.", "Espace disque insuffisant. Choisissez un modèle plus léger ou libérez de l’espace.");
  if (/verification|checksum|hash/i.test(message)) return t("The model failed verification. Download it again.", "La vérification du modèle a échoué. Téléchargez-le à nouveau.");
  if (/reach|network|connect|timeout/i.test(message)) return t("Could not reach the service. Check your connection and server address, then retry.", "Le service est inaccessible. Vérifiez votre connexion et l’adresse du serveur, puis réessayez.");
  return message;
}
