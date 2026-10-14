import React from "react";

/** Windows-style arrow cursor. (x, y) is the hotspot. `click` 0..1 squashes it. */
export const Pointer: React.FC<{ x: number; y: number; click?: number; opacity?: number }> = ({ x, y, click = 0, opacity = 1 }) => (
  <div style={{ position: "absolute", left: x, top: y, opacity, transform: `scale(${1 - 0.18 * click})`, transformOrigin: "0 0", zIndex: 50 }}>
    {click > 0 ? (
      <div style={{ position: "absolute", left: -40, top: -40, width: 80, height: 80, borderRadius: "50%", border: "4px solid #ffffffcc", transform: `scale(${0.3 + click})`, opacity: 1 - click }} />
    ) : null}
    <svg width="52" height="70" viewBox="0 0 26 35" style={{ filter: "drop-shadow(0 6px 10px #0008)" }}>
      <path d="M1 1 L1 27 L7.5 21 L12 32 L16.5 30 L12 19.5 L21 19.5 Z" fill="#fff" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  </div>
);
