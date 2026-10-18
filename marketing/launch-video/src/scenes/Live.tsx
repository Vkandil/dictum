import React from "react";
import { AbsoluteFill } from "remotion";
import { C, FONT, MONO } from "../theme";
import { WORDS } from "../timeline";
import { Hud } from "../components/Hud";
import { inExpo, level, springAt, tween, useTime } from "../util";

// 20.9 → 23.55 s. "Live mode? Your words appear as you speak."
// Words 52..57 are typed on screen exactly as they are spoken.
const FIRST = 52;
const LAST = 57;
const LINES = [[52, 53], [54, 55], [56, 57]];

export const Live: React.FC = () => {
  const t = useTime();
  if (t < 20.85 || t > 23.6) return null;
  const enter = tween(t, 20.86, 21.05);
  const exit = tween(t, 23.38, 23.56, 0, 1, inExpo);
  const pill = springAt(t, 20.92, { damping: 10, stiffness: 220 });
  const dot = 0.5 + 0.5 * Math.sin(t * 9);

  // characters revealed per word, spread over the word's spoken duration
  const reveal = (i: number) => {
    const [word, ws] = WORDS[i];
    const next = i < LAST ? WORDS[i + 1][1] : ws + 0.35;
    const dur = Math.min(next - ws, 0.3);
    return Math.max(0, Math.min(word.length, Math.ceil(((t - ws + 0.03) / dur) * word.length)));
  };
  let lastActive = -1;
  for (let i = FIRST; i <= LAST; i++) if (reveal(i) > 0) lastActive = i;
  const liveText = WORDS.slice(FIRST, LAST + 1).map(([w], k) => w.slice(0, reveal(FIRST + k))).filter(Boolean).join(" ");

  return (
    <AbsoluteFill style={{ opacity: enter * (1 - exit), transform: `translateX(${-exit * 600}px)`, filter: `blur(${exit * 14}px)` }}>
      <div style={{ position: "absolute", left: 90, top: 190, display: "flex", alignItems: "center", gap: 18, padding: "16px 30px 16px 24px", borderRadius: 999, background: "#e5484d22", border: "2px solid #e5484d88", opacity: Math.min(1, pill * 1.5), transform: `scale(${0.6 + 0.4 * pill})`, transformOrigin: "left center" }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.red, boxShadow: `0 0 ${10 + dot * 26}px ${C.red}` }} />
        <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 40, letterSpacing: "0.16em", color: C.white }}>LIVE MODE</span>
      </div>

      <div style={{ position: "absolute", left: 90, right: 60, top: 360, fontFamily: FONT, fontWeight: 800, fontSize: 150, letterSpacing: "-0.055em", lineHeight: 1.04, color: C.white }}>
        {LINES.map((line, li) => (
          <div key={li} style={{ height: 160, whiteSpace: "nowrap" }}>
            {line.map((i) => {
              const n = reveal(i);
              const word = WORDS[i][0];
              return (
                <span key={i} style={{ marginRight: 38 }}>
                  {word.split("").map((ch, k) => {
                    const on = k < n;
                    return (
                      <span key={k} style={{ display: "inline-block", opacity: on ? 1 : 0, color: i === lastActive && k >= n - 2 && t < WORDS[i][1] + 0.5 ? C.orangeHi : C.white }}>
                        {ch}
                      </span>
                    );
                  })}
                  {i === lastActive || (lastActive === -1 && i === FIRST) ? (
                    <span style={{ display: "inline-block", width: 12, height: 130, marginLeft: 10, verticalAlign: "-14px", background: C.orange, opacity: Math.sin(t * 12) > -0.3 ? 1 : 0.15, boxShadow: `0 0 30px ${C.orange}` }} />
                  ) : null}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 930, display: "flex", justifyContent: "center", opacity: tween(t, 21.1, 21.35) }}>
        <Hud phase="listening" level={level(t)} t={t} scale={1.9} width={430} text={liveText || "Listening"} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1068, textAlign: "center", fontFamily: MONO, fontSize: 21, letterSpacing: "0.08em", color: "#ffffff66", opacity: tween(t, 21.3, 21.55) }}>
        LIVE MODE USES A MISTRAL KEY OR A LOCAL SERVER
      </div>
    </AbsoluteFill>
  );
};
