import React from "react";
import { AbsoluteFill } from "remotion";
import { Keyboard, Mic } from "lucide-react";
import { C, FONT, MONO } from "../theme";
import { inExpo, inOut, rand, springAt, tween, useTime } from "../util";

// 14.1 → 18.0 s. "You talk three times faster than you type. So stop typing."
const ROW = ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"];

export const Speed: React.FC = () => {
  const t = useTime();
  if (t < 14.0 || t > 18.1) return null;
  const enter = tween(t, 14.05, 14.3);
  const exit = tween(t, 17.85, 18.05, 0, 1, inExpo);
  const bars = tween(t, 14.3, 15.6, 0, 1, inOut);
  const barsOut = tween(t, 16.4, 16.6, 0, 1, inExpo);
  const three = springAt(t, 14.52, { damping: 10, stiffness: 200 });
  const typing = Math.round(40 * bars);
  const talking = Math.round(120 * bars);

  const Bar = ({ y, icon, label, value, frac, color, glow }: { y: number; icon: React.ReactNode; label: string; value: string; frac: number; color: string; glow?: boolean }) => (
    <div style={{ position: "absolute", left: 90, right: 90, top: y }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: FONT, fontWeight: 700, fontSize: 36, color: C.white, marginBottom: 18 }}>
        {icon}
        {label}
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 32, color: glow ? C.orangeHi : "#ffffffaa" }}>{value}</span>
      </div>
      <div style={{ height: 58, borderRadius: 29, background: "#ffffff0d", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${frac * 100}%`, borderRadius: 29, background: color, boxShadow: glow ? `0 0 50px ${C.orange}` : undefined }} />
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ opacity: enter * (1 - exit), transform: `translateY(${-exit * 300}px)` }}>
      <AbsoluteFill style={{ opacity: 1 - barsOut, transform: `translateY(${-barsOut * 160}px)` }}>
        <div style={{ position: "absolute", left: 90, top: 190, fontFamily: MONO, fontSize: 26, letterSpacing: "0.16em", color: "#ffffff80" }}>WORDS PER MINUTE</div>
        <Bar y={270} icon={<Keyboard size={40} color="#ffffffaa" />} label="Typing" value={`${typing} wpm`} frac={bars * 0.32} color="#6b6c63" />
        <Bar y={450} icon={<Mic size={40} color={C.orangeHi} />} label="Talking" value={`${talking}+ wpm`} frac={bars * 0.96} color={`linear-gradient(90deg, ${C.orange}, ${C.orangeHi})`} glow />
        <div style={{ position: "absolute", left: 0, right: 0, top: 650, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: 330, letterSpacing: "-0.08em", lineHeight: 1, color: C.white, opacity: Math.min(1, three * 1.5), transform: `scale(${0.4 + 0.6 * three})` }}>
          3<span style={{ color: C.orange }}>×</span>
          <div style={{ fontSize: 46, letterSpacing: "-0.02em", fontWeight: 700, color: "#ffffffb0", marginTop: 8, opacity: tween(t, 15.1, 15.35) }}>faster than typing</div>
        </div>
      </AbsoluteFill>

      {/* So stop typing: the keyboard falls apart. */}
      {t > 16.4 ? (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 560, display: "flex", justifyContent: "center", gap: 10 }}>
            {ROW.map((k, i) => {
              const s = springAt(t, 16.42 + i * 0.015, { damping: 14, stiffness: 260 });
              const ft = Math.max(0, t - (16.88 + rand(i) * 0.18));
              const fy = 2400 * ft * ft;
              const fx = (rand(i + 4) - 0.5) * 500 * ft;
              const rot = (rand(i + 8) - 0.5) * 540 * ft;
              return (
                <div key={k} style={{ width: 84, height: 92, borderRadius: 16, background: "linear-gradient(180deg,#fbf9f4,#e4dfd3)", boxShadow: "inset 0 -6px 0 #cfc9bb, 0 14px 30px #0008", display: "flex", alignItems: "flex-end", padding: "0 0 12px 14px", fontFamily: FONT, fontWeight: 700, fontSize: 30, color: C.ink, opacity: Math.min(1, s * 2), transform: `translate(${fx}px, ${fy + (1 - s) * 60}px) rotate(${rot}deg)` }}>
                  {k}
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 330, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: 170, letterSpacing: "-0.06em", lineHeight: 0.95, color: C.white }}>
            <div style={{ opacity: tween(t, 16.82, 16.95), transform: `translateY(${(1 - tween(t, 16.82, 17.0)) * 50}px)` }}>stop</div>
            <div style={{ position: "relative", display: "inline-block", marginTop: 210, opacity: tween(t, 17.22, 17.35), transform: `translateY(${(1 - tween(t, 17.22, 17.4)) * 50}px)` }}>
              typing.
              <div style={{ position: "absolute", left: -20, top: "52%", height: 22, borderRadius: 11, background: C.orange, width: `calc(${tween(t, 17.42, 17.62, 0, 1, inOut) * 100}% + ${tween(t, 17.42, 17.62, 0, 1, inOut) * 40}px)`, boxShadow: `0 0 40px ${C.orange}` }} />
            </div>
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
