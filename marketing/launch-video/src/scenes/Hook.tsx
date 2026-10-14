import React from "react";
import { AbsoluteFill } from "remotion";
import { Mic } from "lucide-react";
import { C, FONT, MONO } from "../theme";
import { WORDS } from "../timeline";
import { inExpo, inOut, rand, springAt, tween, useTime } from "../util";

// 0 → 5.5 s. "Wispr Flow. Every paid speech-to-text app. I just made them free."

const CARDS = [
  { name: "Wispr Flow", plan: "Pro plan", price: "$15" },
  { name: null, plan: "Unlimited", price: "$12" },
  { name: null, plan: "Premium", price: "$20" },
  { name: null, plan: "Plus", price: "$9.99" },
  { name: null, plan: "Teams", price: "$30" },
  { name: null, plan: "Pro", price: "$14" },
];

const CW = 440;
const CH = 176;

const SubCard: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  const c = CARDS[i];
  // Price → $0 slot-machine roll, staggered across cards.
  const roll = tween(t, 3.96 + i * 0.1, 4.28 + i * 0.1, 0, 1, inOut);
  const freeGlow = tween(t, 4.8, 5.0);
  return (
    <div style={{ width: CW, height: CH, borderRadius: 26, background: "linear-gradient(160deg,#25261f,#1a1b17)", border: `1.5px solid ${roll > 0.5 ? "#55785e88" : "#ffffff17"}`, boxShadow: "0 30px 60px #0009", padding: "26px 28px", display: "flex", flexDirection: "column", justifyContent: "space-between", fontFamily: FONT, color: C.white, position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: "#ffffff10", display: "grid", placeItems: "center", color: "#ffffffaa" }}>
          <Mic size={24} />
        </div>
        <div style={{ flex: 1 }}>
          {c.name ? (
            <div style={{ fontWeight: 800, fontSize: 30, letterSpacing: "-0.03em" }}>{c.name}</div>
          ) : (
            <div style={{ width: 120 + rand(i) * 80, height: 18, borderRadius: 9, background: "#ffffff22", margin: "6px 0" }} />
          )}
          <div style={{ fontFamily: MONO, fontSize: 17, color: "#ffffff77", textTransform: "uppercase", letterSpacing: "0.08em" }}>{c.plan}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ height: 70, overflow: "hidden", position: "relative", width: 230 }}>
          <div style={{ transform: `translateY(${-roll * 70}px)`, filter: `blur(${Math.sin(roll * Math.PI) * 6}px)` }}>
            <div style={{ height: 70, fontWeight: 800, fontSize: 60, letterSpacing: "-0.04em", lineHeight: "70px" }}>
              {c.price}<span style={{ fontSize: 26, color: "#ffffff77", fontWeight: 600 }}>/mo</span>
            </div>
            <div style={{ height: 70, fontWeight: 800, fontSize: 60, letterSpacing: "-0.04em", lineHeight: "70px", color: freeGlow > 0 ? C.orangeHi : C.white }}>
              $0<span style={{ fontSize: 26, color: "#ffffff77", fontWeight: 600 }}>/forever</span>
            </div>
          </div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 16, padding: "8px 12px", borderRadius: 999, background: roll > 0.5 ? "#55785e33" : "#ffffff10", color: roll > 0.5 ? "#94d4a4" : "#ffffff88", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {roll > 0.5 ? "cancelled" : "active"}
        </div>
      </div>
    </div>
  );
};

/** Big kinetic headline; each word lands when it is spoken. */
const Headline: React.FC<{ t: number; from: number; to: number; a: number; b: number; size: number; accent?: number[]; y: number }> = ({ t, from, to, a, b, size, accent = [], y }) => {
  if (t < a - 0.1 || t > b + 0.1) return null;
  const out = tween(t, b - 0.15, b, 0, 1, inExpo);
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top: y, display: "flex", flexWrap: "wrap", gap: `0 ${size * 0.26}px`, justifyContent: "center", fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1.0, letterSpacing: "-0.05em", color: C.white }}>
      {WORDS.slice(from, to + 1).map(([word, ws], k) => {
        const i = from + k;
        // The first headline is on screen from frame 0 (it is the thumbnail); it only punches.
        const s = from === 0 ? 1 : springAt(t, ws - 0.07, { damping: 13, stiffness: 220 });
        const punch = from === 0 && t > ws ? Math.exp(-(t - ws) * 9) * Math.sin((t - ws) * 26) * 0.08 : 0;
        const isAccent = accent.includes(i);
        return (
          <span key={i} style={{ display: "inline-block", opacity: Math.min(1, s * 1.4) * (1 - out), transform: `translateY(${(1 - s) * 60 - out * 40}px) scale(${0.85 + 0.15 * s + punch})`, filter: `blur(${(1 - Math.min(1, s)) * 10 + out * 12}px)`, color: isAccent ? C.orange : C.white }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

export const Hook: React.FC = () => {
  const t = useTime();
  if (t > 5.6) return null;
  // Card 0 starts alone and big, then joins the grid.
  const toGrid = tween(t, 1.6, 2.15, 0, 1, inOut);
  const exit = tween(t, 5.32, 5.55, 0, 1, inExpo);
  // Screen shake on the FREE stamp.
  const sh = t > 4.8 ? Math.exp(-(t - 4.8) * 9) * 18 : 0;
  const shx = sh * Math.sin(t * 90);
  const shy = sh * Math.cos(t * 77);
  const stamp = springAt(t, 4.74, { damping: 11, stiffness: 320, mass: 0.6 });
  const flash = t > 4.8 ? Math.exp(-(t - 4.8) * 14) : 0;
  const push = 1 + t * 0.012;

  return (
    <AbsoluteFill style={{ transform: `translate(${shx}px, ${shy}px) scale(${push * (1 + exit * 0.9)})`, opacity: 1 - exit, filter: `blur(${exit * 14}px)` }}>
      <Headline t={t} from={0} to={1} a={0} b={1.62} size={150} y={250} />
      <Headline t={t} from={2} to={5} a={1.62} b={3.86} size={92} y={190} />
      <Headline t={t} from={6} to={10} a={3.86} b={5.55} size={96} y={190} accent={[10]} />

      {CARDS.map((_, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const gx = 88 + col * (CW + 24);
        const gy = 470 + row * (CH + 24);
        if (i === 0) {
          const x = gx + (1 - toGrid) * (540 - CW / 2 - gx);
          const y = gy + (1 - toGrid) * (720 - CH / 2 - gy);
          const s = 1 + (1 - toGrid) * 0.45;
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, transform: `scale(${s})` }}>
              <SubCard i={i} t={t} />
            </div>
          );
        }
        const s = springAt(t, 1.72 + (i - 1) * 0.11, { damping: 12, stiffness: 190 });
        return (
          <div key={i} style={{ position: "absolute", left: gx, top: gy, opacity: Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * 120}px) scale(${0.7 + 0.3 * s}) rotate(${(1 - s) * (col ? 8 : -8)}deg)` }}>
            <SubCard i={i} t={t} />
          </div>
        );
      })}

      {/* FREE stamp */}
      {t > 4.74 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 640, display: "flex", justifyContent: "center" }}>
          <div style={{ transform: `rotate(-9deg) scale(${2.6 - 1.6 * stamp})`, opacity: Math.min(1, stamp * 2), fontFamily: FONT, fontWeight: 800, fontSize: 210, letterSpacing: "-0.04em", color: C.orange, padding: "6px 54px 18px", border: `14px solid ${C.orange}`, borderRadius: 40, background: "#121310e6", boxShadow: `0 0 120px ${C.orange}88`, lineHeight: 1 }}>
            FREE
          </div>
        </div>
      ) : null}
      <AbsoluteFill style={{ background: "#fff", opacity: flash * 0.35, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

