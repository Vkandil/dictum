import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, LoaderCircle, Mic, X } from "lucide-react";
import { cancelRecording, listenDictation } from "../lib/bridge";
import type { DictationState } from "../lib/types";

export default function Overlay() {
  const [state, setState] = useState<DictationState>({ phase: "idle" });
  useEffect(() => {
    let off: (() => void) | undefined;
    listenDictation(setState).then((fn) => { off = fn; });
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") void cancelRecording(); };
    window.addEventListener("keydown", key);
    return () => { off?.(); window.removeEventListener("keydown", key); };
  }, []);

  const bars = useMemo(() => Array.from({ length: 15 }, (_, index) => {
    const wave = .3 + Math.abs(Math.sin(index * .74)) * .7;
    return Math.max(3, (state.level || .06) * 34 * wave);
  }), [state.level]);

  if (state.phase === "idle" || state.phase === "cancelled") return null;
  const working = state.phase === "transcribing" || state.phase === "formatting";
  return <main className="overlay-page">
    <div className={`hud ${state.phase}`}>
      <div className="hud-icon">
        {state.phase === "listening" ? <Mic size={17} /> : working ? <LoaderCircle className="spin" size={17} /> : state.phase === "error" ? <AlertCircle size={17} /> : <Check size={17} />}
      </div>
      <div className="hud-content">
        <div className="hud-title">{state.phase === "listening" ? state.text || "Listening" : state.phase === "transcribing" ? "Transcribing" : state.phase === "formatting" ? "Polishing" : state.phase === "error" ? state.message || "Something went wrong" : state.text || "Inserted"}</div>
        {state.phase === "listening" ? <div className="waveform">{bars.map((height, index) => <i key={index} style={{ height }} />)}</div> : null}
        {working ? <div className="progress-line"><span /></div> : null}
      </div>
      {state.phase === "listening" ? <button aria-label="Cancel" onClick={() => void cancelRecording()}><X size={15} /></button> : null}
    </div>
  </main>;
}
