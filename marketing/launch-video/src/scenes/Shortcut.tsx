import React from "react";
import { AbsoluteFill } from "remotion";
import { Code2, Hash, Mail } from "lucide-react";
import { C, FONT, MONO } from "../theme";
import { Hud } from "../components/Hud";
import { Keycap } from "../components/Keycap";
import { Win } from "../components/Win";
import { inExpo, inOut, level, springAt, tween, useTime } from "../util";

// 9.2 → 14.1 s. "Hold a shortcut. Talk. Boom. Polished text right where your cursor is."

const Caret: React.FC<{ t: number; h?: number; color?: string }> = ({ t, h = 34, color = C.orange }) => (
  <span style={{ display: "inline-block", width: 3, height: h, background: color, marginLeft: 3, verticalAlign: "middle", opacity: Math.sin(t * 12) > -0.2 ? 1 : 0 }} />
);

/** Text dropped in at once, with a highlight sweep (Dictum pastes via the clipboard). */
const Pasted: React.FC<{ t: number; at: number; text: string; style?: React.CSSProperties; caretH?: number; caretColor?: string }> = ({ t, at, text, style, caretH, caretColor }) => {
  const on = t >= at;
  const sweep = tween(t, at, at + 0.28, 0, 1, inOut);
  const fade = tween(t, at + 0.35, at + 0.8, 1, 0);
  return (
    <div style={{ position: "relative", ...style }}>
      {on ? (
        <span style={{ backgroundImage: `linear-gradient(90deg, ${C.orange}44 ${sweep * 100}%, transparent ${sweep * 100}%)`, backgroundColor: `rgba(239,98,58,${0.0 * fade})`, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", opacity: 0.2 + 0.8 * Math.min(1, sweep * 3) }}>
          <span style={{ backgroundColor: `rgba(239,98,58,${0.18 * fade})` }}>{text}</span>
        </span>
      ) : null}
      <Caret t={t} h={caretH} color={caretColor} />
    </div>
  );
};

const Skel: React.FC<{ w: number; c?: string; h?: number }> = ({ w, c = "#d9d5ca", h = 16 }) => <div style={{ width: w, height: h, borderRadius: h / 2, background: c, margin: "8px 0" }} />;

const ChatWin: React.FC<{ t: number }> = ({ t }) => (
  <Win title="Chat — #launch" width={900} height={640} icon={<Hash size={22} />}>
    <div style={{ padding: "28px 34px", display: "flex", flexDirection: "column", gap: 26 }}>
      {[0, 1].map((i) => (
        <div key={i} style={{ display: "flex", gap: 18 }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, background: i ? "#c7d3f7" : "#f3d2c5" }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 22, color: C.ink }}>{i ? "Sam" : "Alex"} <span style={{ fontWeight: 500, color: "#9a9a90", fontSize: 18 }}>10:4{i + 1}</span></div>
            <Skel w={i ? 420 : 520} />
            <Skel w={i ? 300 : 360} />
          </div>
        </div>
      ))}
    </div>
    <div style={{ position: "absolute", left: 30, right: 30, bottom: 30, minHeight: 150, borderRadius: 18, border: "2px solid #d5d1c7", background: "#fffdfa", padding: "22px 24px", fontSize: 33, fontWeight: 600, lineHeight: 1.35, color: C.ink, letterSpacing: "-0.01em" }}>
      <Pasted t={t} at={11.66} text="Hey team! The launch video is ready. Can you review it before 5 pm?" caretH={38} />
    </div>
  </Win>
);

const MailWin: React.FC<{ t: number }> = ({ t }) => (
  <Win title="Mail — New message" width={900} height={640} icon={<Mail size={22} />}>
    <div style={{ padding: "8px 34px", fontSize: 24, color: "#6d6e66" }}>
      <div style={{ padding: "18px 0", borderBottom: "1.5px solid #e6e2d8" }}>To <span style={{ color: C.ink, fontWeight: 700, marginLeft: 12 }}>sarah@company.com</span></div>
      <div style={{ padding: "18px 0", borderBottom: "1.5px solid #e6e2d8" }}>Subject <span style={{ color: C.ink, fontWeight: 700, marginLeft: 12 }}>Q4 roadmap</span></div>
      <Pasted t={t} at={12.74} text="Hi Sarah, here are the three priorities for next quarter, in order: onboarding, performance, and the Windows release." style={{ paddingTop: 26, fontSize: 33, fontWeight: 600, lineHeight: 1.4, color: C.ink }} caretH={38} />
    </div>
  </Win>
);

const CodeWin: React.FC<{ t: number }> = ({ t }) => {
  const lines = [
    ["fn", " insert_text(text: &str) -> Result<()> {"],
    ["", "    let previous = clipboard::read()?;"],
    ["", "    clipboard::write(text)?;"],
    ["", "    send_paste()?;"],
    ["", ""],
    ["", "    clipboard::restore(previous)"],
    ["", "}"],
  ];
  return (
    <Win title="inject.rs — Code" width={900} height={640} dark icon={<Code2 size={22} />}>
      <div style={{ padding: "26px 0", fontFamily: MONO, fontSize: 27, lineHeight: 1.75, color: "#cfd0c8" }}>
        {lines.map(([kw, rest], i) => (
          <div key={i} style={{ display: "flex", background: i === 4 ? "#ffffff08" : undefined }}>
            <span style={{ width: 70, textAlign: "right", paddingRight: 24, color: "#5c5d55" }}>{i + 12}</span>
            {i === 4 ? (
              <Pasted t={t} at={13.3} text="    // Paste, then restore the clipboard." style={{ color: "#7fae86", whiteSpace: "pre" }} caretH={32} caretColor="#cfd0c8" />
            ) : (
              <span style={{ whiteSpace: "pre" }}><span style={{ color: "#e7a07a" }}>{kw}</span>{rest}</span>
            )}
          </div>
        ))}
      </div>
    </Win>
  );
};

export const Shortcut: React.FC = () => {
  const t = useTime();
  if (t < 9.15 || t > 14.2) return null;
  const amp = level(t);

  // A: keycaps
  const keysOut = tween(t, 10.3, 10.55, 0, 1, inExpo);
  const press = tween(t, 9.6, 9.72, 0, 1, inOut);
  const keys = [
    { label: "Ctrl", w: 220 },
    { label: "Shift", w: 250 },
    { label: "Space", w: 400 },
  ];

  // B: HUD alone, listening
  const hudIn = springAt(t, 10.36, { damping: 13, stiffness: 200 });
  const boom = tween(t, 11.0, 11.3, 0, 1, inOut);

  // C: windows strip; whip-pans at 12.64 and 13.2
  const winIn = springAt(t, 11.02, { damping: 15, stiffness: 170 });
  const p1 = tween(t, 12.56, 12.76, 0, 1, inOut);
  const p2 = tween(t, 13.12, 13.32, 0, 1, inOut);
  const pos = p1 + p2;
  const speed = Math.max(Math.sin(p1 * Math.PI), Math.sin(p2 * Math.PI));
  const exit = tween(t, 13.98, 14.18, 0, 1, inExpo);

  const hudPhase = t < 11.5 ? "listening" : t < 11.66 ? "transcribing" : "result";
  // During the window part the HUD rides along the bottom like the real overlay.
  const hudY = 640 + boom * 225;
  const hudScale = 2.3 - boom * 0.8;

  return (
    <AbsoluteFill style={{ transform: `translateX(${-exit * 700}px)`, opacity: 1 - exit, filter: `blur(${exit * 16}px)` }}>
      {/* A — keycaps */}
      {t < 10.6 ? (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 420, textAlign: "center", fontFamily: MONO, fontSize: 28, letterSpacing: "0.16em", color: "#ffffff90", opacity: tween(t, 9.25, 9.5) * (1 - keysOut) }}>
            HOLD TO TALK
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 540, display: "flex", justifyContent: "center", gap: 26 }}>
            {keys.map((k, i) => {
              const s = springAt(t, 9.16 + i * 0.07, { damping: 12, stiffness: 230 });
              return (
                <div key={k.label} style={{ opacity: Math.min(1, s * 2) * (1 - keysOut), transform: `translateY(${(1 - s) * -380 + keysOut * 300}px) rotate(${(1 - s) * (i - 1) * 12}deg)` }}>
                  <Keycap label={k.label} width={k.w} height={160} press={press} glow={press} />
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {/* C — app windows */}
      {t > 11.0 ? (
        <div style={{ position: "absolute", left: 0, top: 170, width: 1080, height: 700, opacity: Math.min(1, winIn * 1.6), transform: `scale(${0.75 + 0.25 * winIn})`, filter: `blur(${speed * 12}px)` }}>
          {[ChatWin, MailWin, CodeWin].map((Comp, i) => (
            <div key={i} style={{ position: "absolute", left: 90 + (i - pos) * 1000, top: 0 }}>
              <Comp t={t} />
            </div>
          ))}
        </div>
      ) : null}

      {/* B — HUD */}
      {t > 10.3 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: hudY, display: "flex", justifyContent: "center", opacity: Math.min(1, hudIn * 1.5), transform: `translateY(${(1 - hudIn) * 120}px)` }}>
          {t < 11.2 ? (
            [0, 1, 2].map((r) => {
              const k = ((t - 10.4) * 1.4 + r / 3) % 1;
              return <div key={r} style={{ position: "absolute", left: 23, top: -107, width: 280, height: 280, borderRadius: "50%", border: `3px solid ${C.orange}`, opacity: (1 - k) * 0.5 * (1 - boom), transform: `scale(${0.4 + k * 1.4})` }} />;
            })
          ) : null}
          <Hud phase={hudPhase} level={amp} t={t} scale={hudScale} text={hudPhase === "result" ? "Inserted at your cursor" : undefined} />
        </div>
      ) : null}
      {/* Boom flash */}
      <AbsoluteFill style={{ background: C.orange, opacity: t > 11.02 ? Math.exp(-(t - 11.02) * 12) * 0.35 : 0 }} />
    </AbsoluteFill>
  );
};
