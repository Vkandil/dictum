import React from "react";
import { AbsoluteFill } from "remotion";
import { Star } from "lucide-react";
import { C, FONT, MONO } from "../theme";
import { WORDS } from "../timeline";
import { Logo } from "../components/Logo";
import { Pointer } from "../components/Pointer";
import { inOut, lerp, level, rand, springAt, tween, useTime } from "../util";

// 35.15 → end. "Dictum. Free, open source. Star it on GitHub and stop paying to talk."
const GH = "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z";
const CLICK = 38.36;

export const Outro: React.FC = () => {
  const t = useTime();
  if (t < 35.1) return null;
  const mix = tween(t, 35.15, 35.55, 0, 1, inOut);
  const word = tween(t, 35.3, 35.65);
  const chips = [
    { label: "FREE", at: 36.0, color: C.orangeHi },
    { label: "OPEN SOURCE", at: 36.64, color: C.blueHi },
    { label: "WINDOWS 10 · 11", at: 36.96, color: C.cream },
  ];
  const gh = springAt(t, 37.7, { damping: 13, stiffness: 200 });
  const starred = t > CLICK;
  const starPop = springAt(t, CLICK, { damping: 7, stiffness: 300 });
  const press = t > CLICK - 0.06 && t < CLICK + 0.08 ? 0.95 : 1;
  const px = lerp(1000, 330, tween(t, 37.85, 38.3, 0, 1, inOut));
  const py = lerp(1300, 990, tween(t, 37.85, 38.3, 0, 1, inOut));
  const click = t > CLICK && t < CLICK + 0.3 ? (t - CLICK) / 0.3 : 0;

  return (
    <AbsoluteFill style={{ opacity: tween(t, 35.18, 35.36) }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 120, display: "flex", justifyContent: "center" }}>
        <Logo height={400} mix={mix} amp={level(t) * (1 - mix * 0.6)} t={t} glow={0.5 + mix * 0.7} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 545, height: 170, overflow: "hidden", textAlign: "center" }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 150, letterSpacing: "-0.06em", color: C.white, transform: `translateY(${(1 - word) * 170}px)` }}>Dictum</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 735, display: "flex", justifyContent: "center", gap: 14 }}>
        {chips.map((c) => {
          const s = springAt(t, c.at - 0.05, { damping: 11, stiffness: 260 });
          return (
            <div key={c.label} style={{ fontFamily: MONO, fontWeight: 500, fontSize: 28, letterSpacing: "0.1em", color: c.color, padding: "14px 24px", borderRadius: 999, border: `2px solid ${c.color}55`, background: `${c.color}14`, opacity: Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * 40}px) scale(${0.6 + 0.4 * s})` }}>
              {c.label}
            </div>
          );
        })}
      </div>

      {/* GitHub star button */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 880, display: "flex", justifyContent: "center", opacity: Math.min(1, gh * 1.5), transform: `translateY(${(1 - gh) * 100}px)` }}>
        <div style={{ display: "flex", alignItems: "stretch", borderRadius: 18, overflow: "visible", border: "2px solid #3d444d", background: "#151b23", fontFamily: FONT, boxShadow: starred ? `0 0 ${80 * starPop}px #e3b34155` : "0 20px 60px #0009", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 30px", borderRight: "2px solid #3d444d", transform: `scale(${press})`, color: "#f0f6fc", fontWeight: 700, fontSize: 38, height: 96, background: starred ? "#e3b34118" : "#212830", borderRadius: "16px 0 0 16px" }}>
            <Star size={44} fill={starred ? "#e3b341" : "none"} color={starred ? "#e3b341" : "#9198a1"} style={{ transform: `scale(${starred ? 0.7 + 0.3 * starPop : 1}) rotate(${starred ? (1 - Math.min(1, starPop)) * -140 : 0}deg)` }} />
            {starred ? "Starred" : "Star"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 30px", color: "#c9d1d9", fontFamily: MONO, fontSize: 30 }}>
            <svg width={40} height={40} viewBox="0 0 16 16"><path d={GH} fill="#f0f6fc" /></svg>
            Vkandil/dictum
          </div>
          {starred
            ? Array.from({ length: 16 }, (_, i) => {
                const k = Math.max(0, t - CLICK);
                const a = (i / 16) * Math.PI * 2 + rand(i) * 0.3;
                const d = (90 + rand(i + 2) * 120) * Math.min(1, k * 3.5);
                return <div key={i} style={{ position: "absolute", left: 78 + Math.cos(a) * d, top: 48 + Math.sin(a) * d, width: 14, height: 14, borderRadius: i % 3 ? "50%" : 3, background: i % 2 ? "#e3b341" : C.orange, opacity: Math.max(0, 1 - k * 1.4), transform: "translate(-50%,-50%)" }} />;
              })
            : null}
        </div>
      </div>
      {t > 37.8 && t < 39.3 ? <Pointer x={px} y={py} click={click} opacity={1 - tween(t, 39.0, 39.3)} /> : null}

      {/* Final line, synced word by word */}
      <div style={{ position: "absolute", left: 40, right: 40, top: 1060, display: "flex", justifyContent: "center", gap: "0 26px", fontFamily: FONT, fontWeight: 800, fontSize: 100, letterSpacing: "-0.05em", color: C.white }}>
        {WORDS.slice(89, 93).map(([w, ws], i) => {
          const s = springAt(t, ws - 0.06, { damping: 12, stiffness: 240 });
          const label = i === 0 ? "Stop" : w;
          return (
            <span key={i} style={{ display: "inline-block", opacity: Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * 60}px)`, color: i === 3 ? C.orange : C.white, filter: `blur(${(1 - Math.min(1, s)) * 8}px)` }}>
              {label}
            </span>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1215, textAlign: "center", fontFamily: MONO, fontSize: 30, color: "#ffffffa0", letterSpacing: "0.04em", opacity: tween(t, 40.3, 40.7) }}>
        github.com/Vkandil/dictum
      </div>
    </AbsoluteFill>
  );
};
