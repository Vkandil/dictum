import React from "react";
import { AbsoluteFill } from "remotion";
import { Mic } from "lucide-react";
import { C, FONT, MONO } from "../theme";
import { WORDS } from "../timeline";
import { inExpo, inOut, rand, springAt, tween, useTime } from "../util";

// 0 → 4.4 s. "I just made Wispr Flow, and every speech-to-text app free."

// Paid dictation / speech-to-text products named in 2026 "Wispr Flow alternatives"
// and transcription roundups (open-source and free-only tools left out on purpose).
const RIVALS = [
  "Wispr Flow", "Superwhisper", "Aqua Voice", "Willow Voice", "Monologue", "MacWhisper",
  "Dragon", "Otter.ai", "Typeless", "Voibe", "Dictation Daddy", "Letterly",
  "AudioPen", "BetterDictation", "VoiceTypr", "Descript", "Notta", "Happy Scribe",
  "Trint", "Rev", "Sonix", "Fireflies.ai",
];

const COLS = 3;
const CW = 300;
const CH = 82;
const GX = 18;
const GY = 16;
const X0 = (1080 - (COLS * CW + (COLS - 1) * GX)) / 2;
const Y0 = 410;
const FREE = 3.68;

const Chip: React.FC<{ name: string; t: number; i: number; hero?: boolean }> = ({ name, t, i, hero }) => {
  const kill = tween(t, FREE + 0.02 + (i % 7) * 0.025, FREE + 0.2 + (i % 7) * 0.025, 0, 1, inOut);
  return (
    <div style={{ position: "relative", width: CW, height: CH, borderRadius: 20, background: hero ? "linear-gradient(160deg,#2b2c25,#1d1e1a)" : "linear-gradient(160deg,#25261f,#1a1b17)", border: `1.5px solid ${hero ? "#ffffff30" : "#ffffff17"}`, boxShadow: "0 18px 40px #0008", display: "flex", alignItems: "center", gap: 12, padding: "0 16px", fontFamily: FONT, color: C.white, filter: `grayscale(${kill}) brightness(${1 - kill * 0.45})` }}>
      <div style={{ width: 40, height: 40, flex: "0 0 auto", borderRadius: 12, background: "#ffffff10", display: "grid", placeItems: "center", color: "#ffffffaa" }}>
        <Mic size={21} />
      </div>
      <div style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: name.length > 13 ? 22 : 25, letterSpacing: "-0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
      <div style={{ fontFamily: MONO, fontSize: 14, padding: "6px 9px", borderRadius: 999, background: "#ffffff12", color: "#ffffff99", letterSpacing: "0.06em" }}>PAID</div>
      {/* the strike that "kills" it */}
      <div style={{ position: "absolute", left: 12, top: CH / 2 - 3, height: 6, borderRadius: 3, width: (CW - 24) * kill, background: C.orange, boxShadow: `0 0 16px ${C.orange}` }} />
    </div>
  );
};

/** Big kinetic headline; each word lands when it is spoken. */
const Headline: React.FC<{ t: number; from: number; to: number; a: number; b: number; size: number; accent?: number[]; y: number; always?: boolean }> = ({ t, from, to, a, b, size, accent = [], y, always }) => {
  if (t < a - 0.1 || t > b + 0.1) return null;
  const out = tween(t, b - 0.15, b, 0, 1, inExpo);
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: y, display: "flex", flexWrap: "wrap", gap: `0 ${size * 0.26}px`, justifyContent: "center", fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1.0, letterSpacing: "-0.05em", color: C.white }}>
      {WORDS.slice(from, to + 1).map(([word, ws], k) => {
        const i = from + k;
        // `always`: on screen from frame 0 (it is the thumbnail); words only punch as they are spoken.
        const s = always ? 1 : springAt(t, ws - 0.07, { damping: 13, stiffness: 220 });
        const punch = always && t > ws ? Math.exp(-(t - ws) * 9) * Math.sin((t - ws) * 26) * 0.08 : 0;
        return (
          <span key={i} style={{ display: "inline-block", opacity: Math.min(1, s * 1.4) * (1 - out), transform: `translateY(${(1 - s) * 60 - out * 40}px) scale(${0.85 + 0.15 * s + punch})`, filter: `blur(${(1 - Math.min(1, s)) * 10 + out * 12}px)`, color: accent.includes(i) ? C.orange : C.white }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

export const Hook: React.FC = () => {
  const t = useTime();
  if (t > 4.5) return null;
  const toGrid = tween(t, 1.68, 2.15, 0, 1, inOut);
  const exit = tween(t, 4.22, 4.45, 0, 1, inExpo);
  const sh = t > FREE ? Math.exp(-(t - FREE) * 9) * 20 : 0;
  const shx = sh * Math.sin(t * 90);
  const shy = sh * Math.cos(t * 77);
  const stamp = springAt(t, FREE - 0.06, { damping: 11, stiffness: 320, mass: 0.6 });
  const flash = t > FREE ? Math.exp(-(t - FREE) * 14) : 0;
  // slow push-in, then the wall pulls back a touch as it fills up
  const cam = 1 + t * 0.012 - tween(t, 1.8, 3.4, 0, 0.04, inOut);

  return (
    <AbsoluteFill style={{ transform: `translate(${shx}px, ${shy}px) scale(${cam * (1 + exit * 0.9)})`, opacity: 1 - exit, filter: `blur(${exit * 14}px)` }}>
      <Headline t={t} from={0} to={3} a={0} b={1.7} size={128} y={210} always />
      <Headline t={t} from={4} to={8} a={1.7} b={4.5} size={84} y={150} accent={[8]} />

      {RIVALS.map((name, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const gx = X0 + col * (CW + GX);
        const gy = Y0 + row * (CH + GY);
        if (i === 0) {
          // Wispr Flow starts alone, big, then takes its place in the wall.
          const s = 1 + (1 - toGrid) * 1.0;
          const x = gx + (1 - toGrid) * (540 - CW / 2 - gx);
          const y = gy + (1 - toGrid) * (760 - CH / 2 - gy);
          return (
            <div key={name} style={{ position: "absolute", left: x, top: y, transform: `scale(${s})` }}>
              <Chip name={name} t={t} i={i} hero />
            </div>
          );
        }
        const s = springAt(t, 1.8 + (i - 1) * 0.062, { damping: 12, stiffness: 230 });
        const fall = t > FREE ? Math.max(0, t - FREE - 0.25 - rand(i) * 0.15) : 0;
        return (
          <div key={name} style={{ position: "absolute", left: gx, top: gy, opacity: Math.min(1, s * 1.6), transform: `translateY(${(1 - s) * 90 + fall * fall * 600}px) scale(${0.6 + 0.4 * s}) rotate(${(1 - s) * (col - 1) * 10 + fall * (rand(i + 3) - 0.5) * 40}deg)` }}>
            <Chip name={name} t={t} i={i} />
          </div>
        );
      })}
      {/* "and many more" tile fills the last two slots */}
      {(() => {
        const s = springAt(t, 1.8 + 21 * 0.062, { damping: 12, stiffness: 230 });
        return (
          <div style={{ position: "absolute", left: X0 + (CW + GX), top: Y0 + 7 * (CH + GY), width: CW * 2 + GX, height: CH, borderRadius: 20, border: "1.5px dashed #ffffff30", display: "grid", placeItems: "center", fontFamily: MONO, fontSize: 24, color: "#ffffff99", letterSpacing: "0.06em", opacity: Math.min(1, s * 1.6) * (1 - tween(t, FREE, FREE + 0.2) * 0.5), transform: `scale(${0.6 + 0.4 * s})` }}>
            + MANY MORE SUBSCRIPTIONS
          </div>
        );
      })()}

      {t > FREE - 0.06 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 680, display: "flex", justifyContent: "center" }}>
          <div style={{ transform: `rotate(-9deg) scale(${2.6 - 1.6 * stamp})`, opacity: Math.min(1, stamp * 2), fontFamily: FONT, fontWeight: 800, fontSize: 220, letterSpacing: "-0.04em", color: C.orange, padding: "6px 56px 18px", border: `14px solid ${C.orange}`, borderRadius: 40, background: "#121310e6", boxShadow: `0 0 140px ${C.orange}99`, lineHeight: 1 }}>
            FREE
          </div>
        </div>
      ) : null}
      <AbsoluteFill style={{ background: "#fff", opacity: flash * 0.35, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
