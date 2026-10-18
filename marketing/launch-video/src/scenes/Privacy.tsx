import React from "react";
import { AbsoluteFill } from "remotion";
import { RadioTower } from "lucide-react";
import { C, FONT, MONO } from "../theme";
import { inExpo, inOut, springAt, tween, useTime } from "../util";

// 42.0 → 43.3 s (scene authored at -10 s). "No telemetry."
export const Privacy: React.FC = () => {
  // Authored against an earlier take; shift onto this voice-over.
  const t = useTime() - 10;
  if (t < 32.0 || t > 33.35) return null;
  const a = springAt(t, 32.08, { damping: 12, stiffness: 200 });
  const slash = tween(t, 32.42, 32.7, 0, 1, inOut);
  const exit = tween(t, 33.05, 33.25, 0, 1, inExpo);

  return (
    <AbsoluteFill style={{ opacity: 1 - exit, filter: `blur(${exit * 10}px)` }}>
      {/* No telemetry */}
      {(
        <AbsoluteFill style={{ opacity: Math.min(1, a * 1.5), transform: `scale(${0.7 + 0.3 * a})` }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", justifyContent: "center" }}>
            <div style={{ position: "relative", width: 300, height: 300, borderRadius: 80, background: "#ffffff0a", border: "2px solid #ffffff18", display: "grid", placeItems: "center", color: "#ffffffcc" }}>
              {[0, 1, 2].map((r) => {
                const k = ((t * 1.2 + r / 3) % 1) * (1 - slash);
                return <div key={r} style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", border: `3px solid ${C.blueHi}`, opacity: (1 - k) * 0.5 * (1 - slash), transform: `scale(${0.5 + k})` }} />;
              })}
              <RadioTower size={150} strokeWidth={1.6} />
              <svg width={300} height={300} style={{ position: "absolute", left: 0, top: 0 }}>
                <line x1={40} y1={40} x2={40 + 220 * slash} y2={40 + 220 * slash} stroke={C.orange} strokeWidth={18} strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 590, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: 140, letterSpacing: "-0.06em", color: C.white }}>
            No telemetry.
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 780, display: "flex", justifyContent: "center", gap: 14 }}>
            {["0 analytics", "0 trackers", "0 crash reporters"].map((c, i) => {
              const s = springAt(t, 32.5 + i * 0.08, { damping: 12, stiffness: 240 });
              return <div key={c} style={{ fontFamily: MONO, fontSize: 25, color: C.cream, padding: "12px 20px", borderRadius: 999, border: "1.5px solid #ffffff2a", background: "#ffffff0d", opacity: Math.min(1, s * 1.5), transform: `scale(${0.7 + 0.3 * s})` }}>{c}</div>;
            })}
          </div>
        </AbsoluteFill>
      )}

    </AbsoluteFill>
  );
};
