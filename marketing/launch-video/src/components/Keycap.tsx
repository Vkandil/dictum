import React from "react";
import { C, FONT } from "../theme";

export const Keycap: React.FC<{ label: string; width: number; height?: number; press?: number; glow?: number; fontSize?: number; style?: React.CSSProperties }> = ({ label, width, height = 150, press = 0, glow = 0, fontSize = 44, style }) => {
  const depth = 18 * (1 - press) + 4;
  return (
    <div style={{ position: "relative", width, height: height + 22, ...style }}>
      {glow > 0 ? (
        <div style={{ position: "absolute", left: 10, right: 10, bottom: -6, height: 40, borderRadius: 30, background: C.orange, filter: "blur(28px)", opacity: glow * 0.85 }} />
      ) : null}
      <div style={{ position: "absolute", left: 0, top: 22 - depth + 18 * press, width, height, borderRadius: 26, background: "#c9c4b6", boxShadow: "0 30px 60px #0008" }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 18 * press,
          width,
          height: height - 4,
          borderRadius: 26,
          background: "linear-gradient(180deg,#fbf9f4,#ece8de)",
          border: "1px solid #ffffff",
          boxShadow: `inset 0 -6px 0 #dcd7cb, inset 0 0 0 ${glow > 0 ? 3 : 0}px ${C.orange}${glow > 0 ? "cc" : "00"}`,
          display: "flex",
          alignItems: "flex-end",
          padding: "0 26px 24px",
          fontFamily: FONT,
          fontWeight: 700,
          fontSize,
          color: C.ink,
          letterSpacing: "-0.02em",
        }}
      >
        {label}
      </div>
    </div>
  );
};
