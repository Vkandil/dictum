import React from "react";
import { AbsoluteFill } from "remotion";
import { BookA, Check, X } from "lucide-react";
import { C, FONT, MONO } from "../theme";
import { inExpo, inOut, springAt, tween, useTime } from "../util";

// 28.0 → 31.3 s. "A dictionary that spells your names and your jargon right."
// Before: what a plain speech model writes. After: the same sentence once the words are
// in your dictionary (Dictum sends them to the model as context).

const NAMES_AT = 29.44;
const JARGON_AT = 30.16;
const RIGHT_AT = 30.8;

type Tok = { a: string; b?: string; at?: number; chip?: number };
const SENTENCE: Tok[] = [
  { a: "Shivon", b: "Siobhan", at: NAMES_AT, chip: 0 },
  { a: "wants" },
  { a: "the" },
  { a: "cooper nettie's", b: "Kubernetes", at: JARGON_AT, chip: 1 },
  { a: "cluster" },
  { a: "on" },
  { a: "super base.", b: "Supabase.", at: JARGON_AT + 0.12, chip: 2 },
];
const CHIPS = ["Siobhan", "Kubernetes", "Supabase", "Dictum", "OKRs", "Vkandil"];

let ctx: CanvasRenderingContext2D | null = null;
const measure = (s: string) => {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  ctx!.font = "800 64px Manrope";
  return ctx!.measureText(s).width * 0.97;
};

export const Dictionary: React.FC = () => {
  const t = useTime();
  if (t < 27.9 || t > 31.45) return null;
  const enter = springAt(t, 27.95, { damping: 15, stiffness: 180 });
  const exit = tween(t, 31.18, 31.38, 0, 1, inExpo);
  const right = t > RIGHT_AT;
  const allFixed = tween(t, RIGHT_AT - 0.05, RIGHT_AT + 0.2);

  return (
    <AbsoluteFill style={{ opacity: Math.min(1, enter * 1.5) * (1 - exit), transform: `translateY(${(1 - enter) * 140}px) translateX(${-exit * 600}px)`, filter: `blur(${exit * 14}px)` }}>
      <div style={{ position: "absolute", left: 90, top: 150, fontFamily: MONO, fontSize: 26, letterSpacing: "0.16em", color: C.blueHi }}>DICTIONARY</div>

      {/* Your dictionary */}
      <div style={{ position: "absolute", left: 70, right: 70, top: 210, borderRadius: 32, background: C.cream, padding: "30px 36px 34px", fontFamily: FONT, color: C.ink, boxShadow: "0 40px 110px #000a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", background: "#e7ecfb", color: C.blue }}><BookA size={28} /></div>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.14em", color: C.orange }}>PERSONAL VOCABULARY</div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em" }}>Your dictionary</div>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
          {CHIPS.map((c, i) => {
            const s = springAt(t, 28.1 + i * 0.07, { damping: 12, stiffness: 260 });
            const use = SENTENCE.find((x) => x.chip === i);
            const fire = use?.at !== undefined && t > use.at ? Math.exp(-(t - use.at) * 4) : 0;
            return (
              <div key={c} style={{ fontFamily: MONO, fontWeight: 500, fontSize: 26, padding: "12px 20px", borderRadius: 999, background: fire > 0.05 ? C.blue : "#fff", color: fire > 0.05 ? "#fff" : C.ink, border: `2px solid ${fire > 0.05 ? C.blue : "#d9d5ca"}`, boxShadow: fire > 0 ? `0 0 ${40 * fire}px ${C.blue}` : undefined, opacity: Math.min(1, s * 1.5), transform: `scale(${(0.6 + 0.4 * s) * (1 + fire * 0.12)})` }}>
                {c}
              </div>
            );
          })}
        </div>
      </div>

      {/* The sentence */}
      <div style={{ position: "absolute", left: 70, right: 70, top: 560, minHeight: 360, borderRadius: 32, background: "linear-gradient(160deg,#25261f,#1a1b17)", border: `2px solid ${right ? "#78a68499" : "#ffffff17"}`, boxShadow: right ? "0 0 90px #78a68433, 0 40px 90px #000a" : "0 40px 90px #000a", padding: "30px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: MONO, fontSize: 23, letterSpacing: "0.12em", color: right ? "#94d4a4" : "#ff8a80" }}>
          {right ? <Check size={26} /> : <X size={26} />}
          {right ? "WITH YOUR DICTIONARY" : "WITHOUT IT"}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 22px", marginTop: 22, fontFamily: FONT, fontWeight: 800, fontSize: 64, letterSpacing: "-0.035em", lineHeight: 1.18, color: C.white }}>
          {SENTENCE.map((tok, i) => {
            if (!tok.b || tok.at === undefined) return <span key={i}>{tok.a}</span>;
            const k = tween(t, tok.at - 0.03, tok.at + 0.22, 0, 1, inOut);
            const bad = tween(t, 28.35, 28.6) * (1 - k);
            return (
              <span key={i} style={{ position: "relative", display: "inline-block", width: measure(tok.a) + (measure(tok.b) - measure(tok.a)) * k, height: 64 * 1.18 }}>
                <span style={{ position: "absolute", left: 0, top: 0, opacity: 1 - k, transform: `translateY(${-k * 50}px)`, color: "#ff8a80", textDecoration: bad > 0 ? "underline wavy" : undefined, textDecorationColor: C.red, textDecorationThickness: 4, textUnderlineOffset: 10, whiteSpace: "nowrap" }}>{tok.a}</span>
                <span style={{ position: "absolute", left: 0, top: 0, opacity: k, transform: `translateY(${(1 - k) * 50}px)`, color: allFixed > 0 ? C.white : "#9fb4ff", textShadow: k > 0 && k < 1 ? `0 0 30px ${C.blueHi}` : undefined, whiteSpace: "nowrap" }}>{tok.b}</span>
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 28, display: "flex", gap: 14, opacity: tween(t, RIGHT_AT, RIGHT_AT + 0.2) }}>
          {["names spelled your way", "no manual fixing"].map((c) => (
            <div key={c} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 23, color: "#94d4a4", padding: "12px 20px", borderRadius: 999, background: "#2d493566", border: "1.5px solid #78a68466" }}>
              <Check size={20} /> {c}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
