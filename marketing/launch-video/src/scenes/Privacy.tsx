import React from "react";
import { AbsoluteFill } from "remotion";
import { HardDrive, Mic, RadioTower, ShieldCheck } from "lucide-react";
import { C, FONT, MONO } from "../theme";
import { inExpo, inOut, level, springAt, tween, useTime } from "../util";

// 32.05 → 35.25 s. "No telemetry. Your audio never touches the disk."
export const Privacy: React.FC = () => {
  const t = useTime();
  if (t < 32.0 || t > 35.35) return null;
  const a = springAt(t, 32.08, { damping: 12, stiffness: 200 });
  const slash = tween(t, 32.42, 32.7, 0, 1, inOut);
  const partA = 1 - tween(t, 33.08, 33.25, 0, 1, inExpo);
  const b = springAt(t, 33.15, { damping: 14, stiffness: 190 });
  const disk = springAt(t, 34.6, { damping: 9, stiffness: 260 });
  const exit = tween(t, 35.05, 35.25, 0, 1, inExpo);
  const amp = level(t);

  return (
    <AbsoluteFill style={{ opacity: 1 - exit, filter: `blur(${exit * 10}px)` }}>
      {/* No telemetry */}
      {partA > 0 ? (
        <AbsoluteFill style={{ opacity: Math.min(1, a * 1.5) * partA, transform: `scale(${(0.7 + 0.3 * a) * (1 + (1 - partA) * 0.5)})` }}>
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
      ) : null}

      {/* Audio never touches the disk */}
      {t > 33.1 ? (
        <AbsoluteFill style={{ opacity: Math.min(1, b * 1.5), transform: `translateY(${(1 - b) * 120}px)` }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 200, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: 104, letterSpacing: "-0.055em", lineHeight: 1.02, color: C.white }}>
            Your audio <span style={{ color: C.orangeHi }}>never</span>
            <br />touches the disk.
          </div>
          {/* stream: mic → RAM → (blocked) disk */}
          <div style={{ position: "absolute", left: 90, top: 560, width: 150, height: 150, borderRadius: 44, background: "#ef623a22", border: `2px solid ${C.orange}88`, display: "grid", placeItems: "center", color: C.orangeHi }}>
            <Mic size={70} />
          </div>
          <div style={{ position: "absolute", left: 250, top: 560, width: 470, height: 150, overflow: "hidden", maskImage: "linear-gradient(90deg, transparent, #000 15%, #000 80%, transparent)" }}>
            {Array.from({ length: 26 }, (_, i) => {
              const x = ((i * 26 + (t - 33) * 420) % 676) - 60;
              const h = 16 + (amp * 0.8 + 0.2) * 110 * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.3 + t * 6)));
              const fade = x > 380 ? Math.max(0, 1 - (x - 380) / 60) : 1;
              return <div key={i} style={{ position: "absolute", left: x, top: 75 - h / 2, width: 12, height: h, borderRadius: 6, background: C.orange, opacity: fade * 0.95 }} />;
            })}
          </div>
          {/* shield wall */}
          <div style={{ position: "absolute", left: 690, top: 540, width: 6, height: 190, borderRadius: 3, background: "#94d4a4", boxShadow: "0 0 30px #94d4a4" }} />
          <div style={{ position: "absolute", left: 655, top: 470, color: "#94d4a4" }}><ShieldCheck size={76} /></div>
          <div style={{ position: "absolute", left: 830, top: 560, width: 150, height: 150, borderRadius: 44, background: "#ffffff08", border: "2px solid #ffffff1c", display: "grid", placeItems: "center", color: "#ffffff66", transform: `scale(${1 + 0.08 * Math.sin(Math.min(1, disk) * Math.PI)})` }}>
            <HardDrive size={70} />
            <svg width={150} height={150} style={{ position: "absolute", left: 0, top: 0 }}>
              <path d={`M40 40 L${40 + 70 * tween(t, 34.6, 34.8)} ${40 + 70 * tween(t, 34.6, 34.8)} M110 40 L${110 - 70 * tween(t, 34.7, 34.9)} ${40 + 70 * tween(t, 34.7, 34.9)}`} stroke={C.red} strokeWidth={12} strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ position: "absolute", left: 250, width: 470, top: 740, textAlign: "center", fontFamily: MONO, fontSize: 24, letterSpacing: "0.1em", color: "#94d4a4" }}>IN MEMORY ONLY</div>
          <div style={{ position: "absolute", left: 830, width: 150, top: 740, textAlign: "center", fontFamily: MONO, fontSize: 24, letterSpacing: "0.1em", color: "#ffffff66" }}>DISK</div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 860, display: "flex", justifyContent: "center", gap: 14 }}>
            {["keys in Windows Credential Manager", "MIT licensed"].map((c, i) => {
              const s = springAt(t, 33.9 + i * 0.1, { damping: 12, stiffness: 240 });
              return <div key={c} style={{ fontFamily: MONO, fontSize: 23, color: C.cream, padding: "12px 20px", borderRadius: 999, border: "1.5px solid #ffffff2a", background: "#ffffff0d", opacity: Math.min(1, s * 1.5), transform: `scale(${0.7 + 0.3 * s})` }}>{c}</div>;
            })}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
