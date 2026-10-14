import React from "react";
import { AbsoluteFill } from "remotion";
import { C, FONT, MONO } from "../theme";
import { Logo } from "../components/Logo";
import { inExpo, inOut, level, tween, useTime } from "../util";

// 8.0 → 9.3 s. "Meet Dictum." The voice's own waveform folds into the logo.
export const Meet: React.FC = () => {
  const t = useTime();
  if (t < 7.95 || t > 9.4) return null;
  const enter = tween(t, 7.98, 8.2);
  const mix = tween(t, 8.32, 8.75, 0, 1, inOut);
  const word = tween(t, 8.5, 8.85);
  const tag = tween(t, 8.7, 9.0);
  const exit = tween(t, 9.1, 9.32, 0, 1, inExpo);
  return (
    <AbsoluteFill style={{ opacity: enter * (1 - exit), transform: `scale(${1 + exit * 3})`, filter: `blur(${exit * 10}px)` }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 220, display: "flex", justifyContent: "center" }}>
        <Logo height={460} mix={mix} amp={level(t) * (1 - mix * 0.7)} t={t} glow={0.6 + mix * 0.6} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 735, textAlign: "center", overflow: "hidden", height: 170 }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 150, letterSpacing: "-0.06em", color: C.white, transform: `translateY(${(1 - word) * 170}px)` }}>Dictum</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 925, textAlign: "center", fontFamily: MONO, fontSize: 28, color: "#ffffffa0", letterSpacing: "0.12em", textTransform: "uppercase", opacity: tag }}>
        voice dictation · for Windows
      </div>
    </AbsoluteFill>
  );
};
