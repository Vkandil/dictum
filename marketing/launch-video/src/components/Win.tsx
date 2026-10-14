import React from "react";
import { FONT } from "../theme";

/** Windows 11 style window frame. */
export const Win: React.FC<{ title: string; width: number; height: number; dark?: boolean; icon?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }> = ({ title, width, height, dark, icon, children, style }) => {
  const fg = dark ? "#cfd0c8" : "#3b3c35";
  return (
    <div style={{ width, height, borderRadius: 18, overflow: "hidden", background: dark ? "#1e1f1b" : "#faf8f3", boxShadow: "0 40px 120px #000a, 0 0 0 1px #ffffff1a", display: "flex", flexDirection: "column", fontFamily: FONT, ...style }}>
      <div style={{ height: 58, flex: "0 0 auto", display: "flex", alignItems: "center", padding: "0 0 0 22px", gap: 12, background: dark ? "#272822" : "#efece4", color: fg, fontSize: 21, fontWeight: 600, borderBottom: `1px solid ${dark ? "#33342e" : "#e2ded4"}` }}>
        {icon}
        <span style={{ flex: 1 }}>{title}</span>
        {[0, 1, 2].map((g) => (
          <svg key={g} width="64" height="20" viewBox="-32 -10 64 20" style={{ opacity: 0.7 }}>
            {g === 0 ? <line x1="-7" y1="0" x2="7" y2="0" stroke={fg} strokeWidth="1.6" /> : null}
            {g === 1 ? <rect x="-6.5" y="-6.5" width="13" height="13" rx="2.5" fill="none" stroke={fg} strokeWidth="1.6" /> : null}
            {g === 2 ? <path d="M-6.5 -6.5 L6.5 6.5 M6.5 -6.5 L-6.5 6.5" stroke={fg} strokeWidth="1.6" /> : null}
          </svg>
        ))}
      </div>
      <div style={{ flex: 1, position: "relative" }}>{children}</div>
    </div>
  );
};
