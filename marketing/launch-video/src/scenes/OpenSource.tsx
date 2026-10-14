import React from "react";
import { AbsoluteFill } from "remotion";
import { C, FONT, MONO } from "../theme";
import { inExpo, inOut, springAt, tween, useTime } from "../util";

// 5.45 → 8.1 s. "And 100% open source."
// Real lines from src-tauri/src/audio.rs scroll behind the counter.
const CODE = [
  "const TARGET_RATE: u32 = 16_000;",
  "const MAX_CHUNK_SECONDS: usize = 25;",
  "pub struct AudioChunk {",
  "    pub wav: Vec<u8>,",
  "    pub duration_ms: u64,",
  "}",
  "struct ActiveRecording {",
  "    stop: mpsc::Sender<()>,",
  "    samples: Arc<Mutex<Vec<f32>>>,",
  "    sample_rate: u32,",
  "    started: Instant,",
  "}",
  "impl AudioRecorder {",
  "    pub fn devices() -> Result<Vec<AudioDevice>> {",
  "use cpal::traits::{DeviceTrait, HostTrait};",
  "use tauri::{AppHandle, Emitter};",
  "#[serde(rename_all = \"camelCase\")]",
  "pub struct AudioDevice {",
  "    pub id: String,",
  "    pub is_default: bool,",
];

export const OpenSource: React.FC = () => {
  const t = useTime();
  if (t < 5.4 || t > 8.2) return null;
  const enter = tween(t, 5.42, 5.7);
  const exit = tween(t, 7.92, 8.15, 0, 1, inExpo);
  const n = Math.round(tween(t, 5.7, 6.75, 0, 100, inOut));
  const pop = springAt(t, 6.72, { damping: 9, stiffness: 260 });
  const punch = t > 6.72 ? Math.exp(-(t - 6.72) * 7) * Math.sin((t - 6.72) * 28) * 0.07 : 0;
  const label = tween(t, 6.9, 7.35);
  const chips = ["MIT license", "Rust + Tauri", "React"];
  return (
    <AbsoluteFill style={{ opacity: enter * (1 - exit), transform: `scale(${(0.9 + 0.1 * enter) * (1 - exit * 0.85)})` }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", maskImage: "radial-gradient(60% 55% at 50% 45%, #000 20%, transparent 100%)" }}>
        <div style={{ position: "absolute", left: 60, top: 80 - (t - 5.4) * 90, fontFamily: MONO, fontSize: 26, lineHeight: 1.75, color: "#ffffff17", whiteSpace: "pre" }}>
          {[...CODE, ...CODE].map((l, i) => (
            <div key={i} style={{ color: i % 7 === 3 ? "#ef623a33" : undefined }}>{l}</div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 280, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: 330, letterSpacing: "-0.07em", color: C.white, lineHeight: 1, transform: `scale(${1 + punch})`, textShadow: `0 0 ${80 * pop}px ${C.blue}` }}>
        {n}
        <span style={{ fontSize: 170, color: C.orange, marginLeft: 8 }}>%</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 650, textAlign: "center", overflow: "hidden", height: 130 }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 112, letterSpacing: "-0.04em", color: C.white, transform: `translateY(${(1 - label) * 130}px)` }}>
          open <span style={{ color: C.blueHi }}>source</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 830, display: "flex", justifyContent: "center", gap: 18 }}>
        {chips.map((c, i) => {
          const s = springAt(t, 7.2 + i * 0.09, { damping: 12, stiffness: 240 });
          return (
            <div key={c} style={{ fontFamily: MONO, fontSize: 26, color: C.cream, padding: "14px 22px", borderRadius: 999, border: "1.5px solid #ffffff2a", background: "#ffffff0d", opacity: Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * 40}px) scale(${0.8 + 0.2 * s})` }}>
              {c}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
