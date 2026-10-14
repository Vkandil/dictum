import React from "react";
import { C } from "../theme";
import { lerp, rand } from "../util";

// Bars of logos/Dictum_png.png, measured from the PNG: [centerX, top, bottom],
// relative to the logo centre. Bar width is 25.5 logo units.
const RAW: [number, number, number][] = [
  [343, 215, 359], [343, 894, 1036], [386.5, 263, 419], [386.5, 833, 989], [431, 305, 485], [431, 767, 947],
  [475.5, 350, 544], [475.5, 707, 903], [520.5, 395, 601], [520.5, 652, 857], [565, 449, 804], [608, 503, 750],
  [644.5, 503, 750], [687.5, 449, 804], [732.5, 395, 601], [732.5, 652, 857], [777, 350, 544], [777, 707, 903],
  [821.5, 305, 485], [821.5, 767, 947], [865.5, 263, 420], [865.5, 833, 989], [910, 215, 359], [910, 894, 1036],
];
export const LOGO_BARS = RAW.map(([x, a, b]) => ({ x: x - 626.5, y1: a - 625.5, y2: b - 625.5 }));
export const BAR_W = 25.5;

type Props = {
  /** Rendered height of the logo in px. */
  height: number;
  /** 0 = flat audio waveform, 1 = the Dictum X. */
  mix: number;
  /** 0..1 audio loudness that drives the waveform and a subtle pulse in logo form. */
  amp?: number;
  /** Seconds, used for idle waveform motion. */
  t: number;
  color?: string;
  glow?: number;
  /** 0 = bars scattered off-screen, 1 = in place. Per-bar stagger. */
  assemble?: number;
  waveSpacing?: number;
};

export const Logo: React.FC<Props> = ({ height, mix, amp = 0, t, color = C.blue, glow = 0, assemble = 1, waveSpacing = 30 }) => {
  const s = height / 846;
  const n = LOGO_BARS.length;
  return (
    <svg width={760 * s} height={height} viewBox="-380 -423 760 846" style={{ overflow: "visible", filter: glow ? `drop-shadow(0 0 ${30 * glow}px ${color}aa)` : undefined }}>
      {LOGO_BARS.map((b, i) => {
        // Waveform slot: bars spread evenly left→right.
        const wx = (i - (n - 1) / 2) * waveSpacing;
        const env = 0.25 + 0.75 * Math.abs(Math.sin(i * 0.9 + t * 7.3 + Math.sin(t * 3 + i)));
        const wh = 40 + amp * 520 * env * (0.55 + 0.45 * Math.sin(i * 1.7));
        const x = lerp(wx, b.x, mix);
        const pulse = 1 + amp * 0.06 * mix * Math.sin(i + t * 20);
        const h = lerp(wh, (b.y2 - b.y1) * pulse, mix);
        const cy = lerp(0, (b.y1 + b.y2) / 2, mix);
        // Assembly: each bar flies in from its own direction.
        const k = Math.max(0, Math.min(1, assemble * 1.6 - rand(i) * 0.6));
        const e = 1 - Math.pow(1 - k, 3);
        const dx = (rand(i + 9) - 0.5) * 1800 * (1 - e);
        const dy = (rand(i + 31) - 0.5) * 2200 * (1 - e);
        const rot = (rand(i + 77) - 0.5) * 360 * (1 - e);
        return (
          <rect
            key={i}
            x={-BAR_W / 2}
            y={-h / 2}
            width={BAR_W}
            height={Math.max(BAR_W, h)}
            rx={BAR_W / 2}
            fill={color}
            opacity={e}
            transform={`translate(${x + dx} ${cy + dy}) rotate(${rot})`}
          />
        );
      })}
    </svg>
  );
};
