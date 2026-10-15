import { Zap } from "lucide-react";
import { useI18n } from "../lib/i18n";

/**
 * Shown on pages whose feature does nothing while Live mode is on. Live transcription inserts
 * Voxtral's raw text as you speak, which never passes through snippet expansion, the personal
 * dictionary, or AI formatting - so without this, someone could carefully build snippets and
 * never understand why they don't fire.
 */
export default function LiveModeNotice({ feature }: { feature: string }) {
  const { t } = useI18n();
  return <div className="live-mode-notice">
    <Zap size={15} />
    <p><strong>{feature} {t("are paused in Live mode.", "sont désactivés en mode Live.")}</strong> {t("Live transcription inserts words as you speak. Choose Polished in Settings to use snippets again.", "Le texte est inséré pendant que vous parlez. Choisissez Après la dictée dans les réglages pour réactiver les extraits.")}</p>
  </div>;
}
