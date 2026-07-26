import { Zap } from "lucide-react";

/**
 * Shown on pages whose feature does nothing while Live mode is on. Live transcription inserts
 * Voxtral's raw text as you speak, which never passes through snippet expansion, the personal
 * dictionary, or AI formatting - so without this, someone could carefully build snippets and
 * never understand why they don't fire.
 */
export default function LiveModeNotice({ feature }: { feature: string }) {
  return <div className="live-mode-notice">
    <Zap size={15} />
    <p><strong>{feature} are paused in Live mode.</strong> Live transcription types your words as you speak them, which skips {feature.toLowerCase()}. Switch to Polished in Settings → How your text appears to use them again.</p>
  </div>;
}
