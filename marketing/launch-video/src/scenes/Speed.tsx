import React from "react";
import { AbsoluteFill } from "remotion";
import { Keyboard, Mic } from "lucide-react";
import { C, FONT, MONO } from "../theme";
import { inExpo, inOut, springAt, tween, useTime } from "../util";

// 13.6 → 15.9 s (scene authored at +0.48 s). "You talk three times faster than you type."

export const Speed: React.FC = () => {
  // Authored against an earlier take; shift onto this voice-over.
  const t = useTime() + 0.48;
  if (t < 14.0 || t > 16.5) return null;
  const enter = tween(t, 14.05, 14.3);
  const exit = tween(t, 16.18, 16.38, 0, 1, inExpo);
  const bars = tween(t, 14.3, 15.6, 0, 1, inOut);
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
      <AbsoluteFill>
        <div style={{ position: "absolute", left: 90, top: 190, fontFamily: MONO, fontSize: 26, letterSpacing: "0.16em", color: "#ffffff80" }}>WORDS PER MINUTE</div>
        <Bar y={270} icon={<Keyboard size={40} color="#ffffffaa" />} label="Typing" value={`${typing} wpm`} frac={bars * 0.32} color="#6b6c63" />
        <Bar y={450} icon={<Mic size={40} color={C.orangeHi} />} label="Talking" value={`${talking}+ wpm`} frac={bars * 0.96} color={`linear-gradient(90deg, ${C.orange}, ${C.orangeHi})`} glow />
        <div style={{ position: "absolute", left: 0, right: 0, top: 650, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: 330, letterSpacing: "-0.08em", lineHeight: 1, color: C.white, opacity: Math.min(1, three * 1.5), transform: `scale(${0.4 + 0.6 * three})` }}>
          3<span style={{ color: C.orange }}>×</span>
          <div style={{ fontSize: 46, letterSpacing: "-0.02em", fontWeight: 700, color: "#ffffffb0", marginTop: 8, opacity: tween(t, 15.1, 15.35) }}>faster than typing</div>
        </div>
      </AbsoluteFill>

    </AbsoluteFill>
  );
};
