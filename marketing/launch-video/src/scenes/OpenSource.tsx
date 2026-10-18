import React from "react";
import { AbsoluteFill } from "remotion";
import { C, FONT, MONO } from "../theme";
import { Check, Download } from "lucide-react";
import { Pointer } from "../components/Pointer";
import { inExpo, inOut, springAt, tween, useTime } from "../util";

// 4.3 → 7.5 s. "100% open source so you can download it now."
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
  if (t < 4.25 || t > 7.55) return null;
  const enter = tween(t, 4.28, 4.5);
  const exit = tween(t, 7.3, 7.52, 0, 1, inExpo);
  const n = Math.round(tween(t, 4.36, 5.2, 0, 100, inOut));
  const punch = t > 5.2 ? Math.exp(-(t - 5.2) * 7) * Math.sin((t - 5.2) * 28) * 0.07 : 0;
  const label = tween(t, 5.22, 5.6);
  // "so you can download it now": button → click → progress → done
  const btn = springAt(t, 5.95, { damping: 13, stiffness: 220 });
  const CLICK = 6.4;
  const prog = tween(t, CLICK + 0.05, 6.95, 0, 1, inOut);
  const done = t > 6.96;
  const press = t > CLICK - 0.05 && t < CLICK + 0.08 ? 0.95 : 1;
  const px = 1000 - tween(t, 6.0, 6.36, 0, 1, inOut) * 330;
  const py = 1180 - tween(t, 6.0, 6.36, 0, 1, inOut) * 350;
  const click = t > CLICK && t < CLICK + 0.3 ? (t - CLICK) / 0.3 : 0;
  return (
    <AbsoluteFill style={{ opacity: enter * (1 - exit), transform: `scale(${(0.9 + 0.1 * enter) * (1 - exit * 0.85)})` }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", maskImage: "radial-gradient(60% 55% at 50% 45%, #000 20%, transparent 100%)" }}>
        <div style={{ position: "absolute", left: 60, top: 80 - (t - 4.25) * 90, fontFamily: MONO, fontSize: 26, lineHeight: 1.75, color: "#ffffff17", whiteSpace: "pre" }}>
          {[...CODE, ...CODE].map((l, i) => (
            <div key={i} style={{ color: i % 7 === 3 ? "#ef623a33" : undefined }}>{l}</div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 200, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: 330, letterSpacing: "-0.07em", color: C.white, lineHeight: 1, transform: `scale(${1 + punch})`, textShadow: `0 0 ${t > 5.2 ? 80 : 0}px ${C.blue}` }}>
        {n}
        <span style={{ fontSize: 170, color: C.orange, marginLeft: 8 }}>%</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", overflow: "hidden", height: 130 }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 112, letterSpacing: "-0.04em", color: C.white, transform: `translateY(${(1 - label) * 130}px)` }}>
          open <span style={{ color: C.blueHi }}>source</span>
        </div>
      </div>
      {t > 5.9 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 760, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: Math.min(1, btn * 1.5), transform: `translateY(${(1 - btn) * 80}px)` }}>
          <div style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 18, padding: "0 40px", height: 110, borderRadius: 24, background: done ? "#55785e" : C.blue, color: "#fff", fontFamily: FONT, fontWeight: 800, fontSize: 44, letterSpacing: "-0.02em", transform: `scale(${press})`, boxShadow: `0 20px 60px ${done ? "#55785e66" : "#073afd66"}` }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${prog * 100}%`, background: "#ffffff22" }} />
            <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
              {done ? <Check size={46} /> : <Download size={46} />}
              {done ? "Downloaded" : t > CLICK ? `Downloading… ${Math.round(prog * 100)}%` : "Download for Windows"}
            </span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 24, color: "#ffffff88" }}>{done ? "Dictum_x64-setup.exe · free · MIT" : "Windows 10 & 11 · free · MIT license"}</div>
        </div>
      ) : null}
      {t > 5.98 && t < 7.2 ? <Pointer x={px} y={py} click={click} /> : null}
    </AbsoluteFill>
  );
};
