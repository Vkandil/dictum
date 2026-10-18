import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, FONT, MONO, DURATION_S } from "../theme";
import { PHRASES, WORDS } from "../timeline";
import { level, rand, tween, useTime, inOut } from "../util";
import { Logo } from "./Logo";

/** Dark stage with slow drifting glows and film grain. */
export const Background: React.FC = () => {
  const t = useTime();
  const a = level(t);
  // Glow colour follows the story: orange (problem) → blue (Dictum) → green (privacy) → blue.
  const blue = tween(t, 7.8, 8.6) * (1 - tween(t, 31.9, 32.4) * 0.6) + tween(t, 35, 35.6) * 0.6;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 40%, ${C.bg2} 0%, ${C.bg} 60%, #0b0c0a 100%)` }}>
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", left: 300 + Math.sin(t * 0.35) * 160, top: -250 + Math.cos(t * 0.27) * 120, background: C.blue, filter: "blur(200px)", opacity: 0.1 + 0.18 * blue + a * 0.06 }} />
      <div style={{ position: "absolute", width: 800, height: 800, borderRadius: "50%", left: -300 + Math.cos(t * 0.3) * 140, top: 700 + Math.sin(t * 0.4) * 140, background: C.orange, filter: "blur(220px)", opacity: 0.12 + 0.1 * (1 - blue) }} />
      <AbsoluteFill style={{ backgroundImage: "linear-gradient(#ffffff06 1px, transparent 1px), linear-gradient(90deg, #ffffff06 1px, transparent 1px)", backgroundSize: "54px 54px", maskImage: "radial-gradient(70% 60% at 50% 45%, #000 0%, transparent 100%)" }} />
    </AbsoluteFill>
  );
};

export const Grain: React.FC = () => {
  const t = useTime();
  const f = Math.floor(t * 24);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <Img src={staticFile("grain.png")} style={{ position: "absolute", width: 1300, height: 1600, left: -100 - rand(f) * 100, top: -100 - rand(f + 5) * 100, opacity: 0.07, mixBlendMode: "overlay" }} />
      <AbsoluteFill style={{ background: "radial-gradient(110% 90% at 50% 50%, transparent 55%, #000a 100%)" }} />
    </AbsoluteFill>
  );
};

/** Word-by-word karaoke captions in the lower band, for muted autoplay. */
export const Captions: React.FC = () => {
  const t = useTime();
  let idx = -1;
  PHRASES.forEach((p, i) => {
    const start = p ? WORDS[p[0]][1] : nullStart(i);
    if (t >= start - 0.08) idx = i;
  });
  const p = idx >= 0 ? PHRASES[idx] : null;
  if (!p) return null;
  const start = WORDS[p[0]][1];
  const nextStart = idx + 1 < PHRASES.length ? (PHRASES[idx + 1] ? WORDS[PHRASES[idx + 1]![0]][1] : nullStart(idx + 1)) : 99;
  const end = Math.min(nextStart - 0.04, WORDS[p[1]][1] + 1.1);
  if (t > end) return null;
  const words = WORDS.slice(p[0], p[1] + 1);
  const out = tween(t, end - 0.12, end, 1, 0, inOut);
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: 1150, height: 150, display: "flex", flexWrap: "wrap", justifyContent: "center", alignContent: "center", gap: "4px 16px", opacity: out }}>
      {words.map(([word, ws], i) => {
        const nextW = i + 1 < words.length ? words[i + 1][1] : ws + 0.5;
        const on = tween(t, ws - 0.06, ws + 0.1);
        const active = t >= ws - 0.04 && t < nextW - 0.02;
        const y = (1 - tween(t, start - 0.08, start + 0.12)) * 30;
        return (
          <span key={i} style={{ fontFamily: FONT, fontWeight: 800, fontSize: 54, letterSpacing: "-0.03em", color: active ? C.orangeHi : C.white, opacity: 0.32 + 0.68 * on, transform: `translateY(${y}px) scale(${active ? 1.06 : 1})`, display: "inline-block", textShadow: "0 4px 24px #000c" }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

// A hidden phrase still needs a start time so the previous caption knows when to leave.
const nullStart = (i: number) => {
  // index of the first word not covered by the previous phrase
  for (let j = i - 1; j >= 0; j--) {
    const prev = PHRASES[j];
    if (prev) return WORDS[prev[1] + 1][1];
  }
  return 0;
};

/** Brand bug: logo + repo URL along the top. */
export const TopBar: React.FC = () => {
  const t = useTime();
  const show = tween(t, 9.2, 9.6) * (1 - tween(t, 34.9, 35.2));
  return (
    <>
      <div style={{ position: "absolute", left: 48, right: 48, top: 44, display: "flex", alignItems: "center", gap: 14, opacity: show, transform: `translateY(${(1 - show) * -20}px)` }}>
        <Logo height={40} mix={1} t={t} />
        <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: C.white, letterSpacing: "-0.03em" }}>Dictum</span>
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 22, color: "#ffffff88", letterSpacing: "0.02em" }}>github.com/Vkandil/dictum</span>
      </div>
    </>
  );
};

export { DURATION_S };
