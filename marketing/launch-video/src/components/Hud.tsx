import React from "react";
import { Check, LoaderCircle, Mic, X } from "lucide-react";
import { C, FONT } from "../theme";

// Faithful re-creation of the recording HUD (src/routes/Overlay.tsx + styles.css),
// drawn at its CSS size (390px wide) and scaled up.
type Props = {
  phase: "listening" | "transcribing" | "result";
  level: number;
  t: number;
  scale?: number;
  text?: string;
  width?: number;
};

export const Hud: React.FC<Props> = ({ phase, level, t, scale = 2, text, width = 390 }) => {
  const bars = Array.from({ length: 15 }, (_, i) => {
    const wave = 0.3 + Math.abs(Math.sin(i * 0.74 + t * 9)) * 0.7;
    return Math.max(3, (level || 0.06) * 34 * wave);
  });
  const result = phase === "result";
  const title = phase === "listening" ? text || "Listening" : phase === "transcribing" ? "Transcribing" : text || "Inserted";
  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: "center", width, fontFamily: FONT }}>
      <div
        style={{
          width,
          minHeight: 66,
          borderRadius: 18,
          color: "white",
          background: result ? "#2d4935" : "#30312c",
          display: "grid",
          gridTemplateColumns: "38px 1fr auto",
          alignItems: "center",
          gap: 10,
          padding: "11px 13px",
          boxShadow: "0 14px 45px #0007",
          border: "1px solid #ffffff1a",
        }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 12, display: "grid", placeItems: "center", background: "#ffffff12", color: result ? "#94d4a4" : C.orangeHi }}>
          {phase === "listening" ? <Mic size={17} /> : phase === "transcribing" ? <LoaderCircle size={17} style={{ transform: `rotate(${t * 450}deg)` }} /> : <Check size={17} />}
        </div>
        <div>
          <div style={{ fontSize: 11.5, lineHeight: 1.35, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          {phase === "listening" ? (
            <div style={{ height: 22, display: "flex", alignItems: "center", gap: 3, marginTop: 3 }}>
              {bars.map((h, i) => (
                <i key={i} style={{ display: "block", width: 2, height: h, borderRadius: 5, background: "#f77b55" }} />
              ))}
            </div>
          ) : null}
          {phase === "transcribing" ? (
            <div style={{ marginTop: 7, width: "100%", height: 2, borderRadius: 9, overflow: "hidden", background: "#ffffff17" }}>
              <span style={{ display: "block", width: "45%", height: "100%", background: "#ff7951", transform: `translateX(${(Math.sin(t * 6) * 0.5 + 0.5) * 120}%)` }} />
            </div>
          ) : null}
        </div>
        {phase === "listening" ? (
          <div style={{ color: "#aaa", background: "#ffffff0d", borderRadius: "50%", width: 27, height: 27, display: "grid", placeItems: "center" }}>
            <X size={15} />
          </div>
        ) : <div />}
      </div>
    </div>
  );
};
