import React from "react";
import { AbsoluteFill } from "remotion";
import { Check, Mic } from "lucide-react";
import { C, FONT, MONO } from "../theme";
import { inExpo, inOut, rand, springAt, tween, useTime } from "../util";

// 17.95 → 21.9 s. "Your uhs, your ums, gone. Grammar? Fixed."
type Tok = { raw: string; fixed?: string; filler?: number; typo?: boolean };
const TOKENS: Tok[] = [
  { raw: "so", fixed: "So", typo: true },
  { raw: "um", filler: 19.04 },
  { raw: "i", fixed: "I", typo: true },
  { raw: "think" },
  { raw: "we" },
  { raw: "should" },
  { raw: "uh", filler: 18.24 },
  { raw: "ship" },
  { raw: "the" },
  { raw: "the", filler: 19.3 },
  { raw: "update" },
  { raw: "tomorow", fixed: "tomorrow.", typo: true },
];

const FS = 74;
let ctx: CanvasRenderingContext2D | null = null;
const measure = (s: string) => {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  ctx!.font = `800 ${FS}px Manrope`;
  return ctx!.measureText(s).width;
};

const GONE = 19.84;
const GRAMMAR = 20.48;
const FIXED = 21.28;

export const Cleanup: React.FC = () => {
  const t = useTime();
  if (t < 17.9 || t > 22.0) return null;
  const enter = springAt(t, 17.92, { damping: 15, stiffness: 180 });
  const exit = tween(t, 21.82, 22.0, 0, 1, inExpo);
  const collapse = tween(t, GONE + 0.05, GONE + 0.4, 0, 1, inOut);
  const fixed = tween(t, FIXED - 0.04, FIXED + 0.22, 0, 1, inOut);
  const wavy = tween(t, GRAMMAR - 0.05, GRAMMAR + 0.3) * (1 - fixed);
  const polished = t > FIXED;

  return (
    <AbsoluteFill style={{ opacity: Math.min(1, enter * 1.5) * (1 - exit), transform: `translateX(${-exit * 600}px) translateY(${(1 - enter) * 120}px)`, filter: `blur(${exit * 14}px)` }}>
      <div style={{ position: "absolute", left: 70, right: 70, top: 260, minHeight: 560, borderRadius: 36, background: "linear-gradient(160deg,#25261f,#1a1b17)", border: `2px solid ${polished ? "#78a68499" : "#ffffff17"}`, boxShadow: polished ? "0 0 90px #78a68433, 0 40px 90px #000a" : "0 40px 90px #000a", padding: "40px 46px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: MONO, fontSize: 25, letterSpacing: "0.12em", color: polished ? "#94d4a4" : "#ffffff88", marginBottom: 34 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", background: polished ? "#2d4935" : "#ffffff12", color: polished ? "#94d4a4" : C.orangeHi }}>
            {polished ? <Check size={28} /> : <Mic size={28} />}
          </div>
          {polished ? "POLISHED" : "WHAT YOU SAID"}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", rowGap: 18, fontFamily: FONT, fontWeight: 800, fontSize: FS, letterSpacing: "-0.035em", lineHeight: `${FS * 1.15}px`, color: C.white }}>
          {TOKENS.map((tok, i) => {
            const wFull = measure(tok.raw) + 22;
            if (tok.filler !== undefined) {
              const hl = tween(t, tok.filler - 0.05, tok.filler + 0.12);
              const w = wFull * (1 - collapse);
              return (
                <span key={i} style={{ position: "relative", display: "inline-block", width: w, height: FS * 1.15, whiteSpace: "nowrap" }}>
                  {tok.raw.split("").map((ch, k) => {
                    const ft = Math.max(0, t - GONE - k * 0.02);
                    const vx = (rand(i * 7 + k) - 0.5) * 900;
                    const vy = -300 - rand(i * 3 + k) * 600;
                    return (
                      <span key={k} style={{ position: "absolute", left: measure(tok.raw.slice(0, k)), top: 0, color: hl > 0 ? C.orangeHi : C.white, opacity: ft > 0 ? Math.max(0, 1 - ft * 2.6) : 1, transform: `translate(${vx * ft}px, ${vy * ft + 1500 * ft * ft}px) rotate(${vx * ft * 0.8}deg) scale(${1 + ft})`, filter: ft > 0 ? `blur(${ft * 6}px)` : undefined }}>
                        {ch}
                      </span>
                    );
                  })}
                  {/* highlight pill */}
                  <span style={{ position: "absolute", left: -2, right: 8, top: 4, bottom: 0, borderRadius: 14, background: C.orange, opacity: hl * 0.25 * (t < GONE ? 1 : 0), transform: `scale(${0.8 + 0.2 * hl})` }} />
                </span>
              );
            }
            const sp = 22;
            if (tok.fixed) {
              const wa = measure(tok.raw);
              const wb = measure(tok.fixed);
              return (
                <span key={i} style={{ position: "relative", display: "inline-block", width: wa + (wb - wa) * fixed + sp, height: FS * 1.15, overflow: "visible" }}>
                  <span style={{ position: "absolute", left: 0, top: 0, opacity: 1 - fixed, transform: `translateY(${-fixed * 40}px)` }}>{tok.raw}</span>
                  <span style={{ position: "absolute", left: 0, top: 0, opacity: fixed, transform: `translateY(${(1 - fixed) * 40}px)`, color: fixed > 0 && fixed < 1 ? "#94d4a4" : t > FIXED + 0.6 ? C.white : "#c8ebd0" }}>{tok.fixed}</span>
                  {tok.typo && wavy > 0 ? (
                    <svg width={wa} height={22} style={{ position: "absolute", left: 0, top: FS * 1.08 }} viewBox={`0 0 ${wa} 22`}>
                      <path d={Array.from({ length: Math.ceil(wa / 14) + 1 }, (_, k) => `${k === 0 ? "M" : "L"}${k * 14} ${k % 2 ? 4 : 16}`).join(" ")} fill="none" stroke={C.red} strokeWidth={5} strokeLinecap="round" strokeDasharray={wa * 2} strokeDashoffset={wa * 2 * (1 - wavy)} />
                    </svg>
                  ) : null}
                </span>
              );
            }
            return <span key={i} style={{ display: "inline-block", width: measure(tok.raw) + sp, height: FS * 1.15 }}>{tok.raw}</span>;
          })}
        </div>
      </div>
      {polished ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 880, display: "flex", justifyContent: "center", gap: 16 }}>
          {["fillers removed", "grammar fixed"].map((c, i) => {
            const s = springAt(t, FIXED + 0.1 + i * 0.1, { damping: 12, stiffness: 240 });
            return (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 25, color: "#94d4a4", padding: "13px 22px", borderRadius: 999, background: "#2d493566", border: "1.5px solid #78a68466", opacity: Math.min(1, s * 1.5), transform: `scale(${0.7 + 0.3 * s})` }}>
                <Check size={22} /> {c}
              </div>
            );
          })}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
