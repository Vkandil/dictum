import React from "react";
import { AbsoluteFill } from "remotion";
import { Clipboard, CloudOff, Laptop, Pencil, Search, Trash2 } from "lucide-react";
import { C, FONT, MONO } from "../theme";
import { inExpo, inOut, springAt, tween, useTime } from "../util";

// 31.3 → 36.1 s. "And a History of everything you've said: searchable, and stored only on your PC."
// Mirrors src/routes/History.tsx: meta row (time · app · duration), text, model · cost, actions.

const ITEMS = [
  { time: "Today 09:41", app: "Mail", dur: "11.2s", text: "Hi Sarah, here are the three priorities for next quarter, roadmap first." },
  { time: "Today 09:12", app: "Slack", dur: "6.8s", text: "Ship the Windows build tonight and ping me when CI is green." },
  { time: "Yesterday 18:03", app: "Notion", dur: "14.5s", text: "Draft: the Q4 roadmap focuses on onboarding and performance." },
  { time: "Yesterday 16:40", app: "Teams", dur: "4.1s", text: "Can we move the design review to 3 pm?" },
  { time: "Mon 11:27", app: "Notes", dur: "3.6s", text: "Remind me to call the accountant on Friday." },
  { time: "Mon 10:02", app: "VS Code", dur: "7.9s", text: "Paste at the cursor, then restore the clipboard." },
];
const QUERY = "roadmap";
const SEARCH_AT = 33.6;
const LOCAL_AT = 34.4;
const ROW_H = 168;

const Highlight: React.FC<{ text: string; on: number }> = ({ text, on }) => {
  const i = text.toLowerCase().indexOf(QUERY);
  if (i < 0 || on <= 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: `rgba(239,98,58,${0.32 * on})`, color: "inherit", borderRadius: 6, padding: "0 3px" }}>{text.slice(i, i + QUERY.length)}</mark>
      {text.slice(i + QUERY.length)}
    </>
  );
};

export const History: React.FC = () => {
  const t = useTime();
  if (t < 31.2 || t > 36.25) return null;
  const enter = springAt(t, 31.28, { damping: 15, stiffness: 170 });
  const exit = tween(t, 35.98, 36.18, 0, 1, inExpo);
  const typed = Math.round(tween(t, SEARCH_AT, SEARCH_AT + 0.4, 0, QUERY.length));
  const filter = tween(t, SEARCH_AT + 0.4, SEARCH_AT + 0.7, 0, 1, inOut);
  const hl = tween(t, SEARCH_AT + 0.55, SEARCH_AT + 0.8);
  const badge = springAt(t, LOCAL_AT, { damping: 12, stiffness: 220 });
  // list scrolls as new dictations keep arriving
  const scroll = tween(t, 31.6, 33.3, 0, 1, inOut) * (1 - filter);

  return (
    <AbsoluteFill style={{ opacity: Math.min(1, enter * 1.5) * (1 - exit), transform: `translateY(${(1 - enter) * 160 - exit * 200}px)`, filter: `blur(${exit * 12}px)` }}>
      <div style={{ position: "absolute", left: 90, top: 150, fontFamily: MONO, fontSize: 26, letterSpacing: "0.16em", color: "#94d4a4" }}>HISTORY</div>
      <div style={{ position: "absolute", left: 70, right: 70, top: 210, height: 820, borderRadius: 30, overflow: "hidden", background: "#f2efe8", boxShadow: "0 40px 120px #000a", fontFamily: FONT, color: C.ink }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "32px 36px 22px" }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.14em", color: C.orange }}>YOUR WORDS STAY YOURS</div>
            <div style={{ fontSize: 54, fontWeight: 800, letterSpacing: "-0.045em" }}>History</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, width: 330, height: 58, padding: "0 18px", borderRadius: 14, background: "#faf8f3", border: `2px solid ${t > SEARCH_AT ? "#e27657" : "#dedbd2"}`, boxShadow: t > SEARCH_AT ? "0 0 0 5px #ef623a1c" : undefined, fontSize: 24, fontWeight: 600 }}>
            <Search size={22} color="#73746b" />
            {typed > 0 ? <span>{QUERY.slice(0, typed)}</span> : <span style={{ color: "#a3a39b" }}>Search dictations</span>}
            {t > SEARCH_AT && t < SEARCH_AT + 0.9 ? <span style={{ width: 2, height: 26, background: C.orange, opacity: Math.sin(t * 14) > 0 ? 1 : 0 }} /> : null}
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 150, bottom: 0, overflow: "hidden" }}>
          {ITEMS.map((it, i) => {
            const match = it.text.toLowerCase().includes(QUERY);
            const s = springAt(t, 31.35 + i * 0.16, { damping: 14, stiffness: 220 });
            // rank among matches after filtering
            const rank = ITEMS.slice(0, i).filter((x) => x.text.toLowerCase().includes(QUERY)).length;
            const y0 = i * ROW_H - scroll * ROW_H * 1.2;
            const y = match ? y0 + (rank * ROW_H - y0) * filter : y0;
            const gone = match ? 0 : filter;
            return (
              <div key={i} style={{ position: "absolute", left: 36, right: 36, top: y + 4, height: ROW_H - 16, borderRadius: 20, background: "#faf8f3", border: `1.5px solid ${match && hl > 0 ? "#e9987e" : "#dedbd2"}`, padding: "18px 24px", opacity: Math.min(1, s * 1.5) * (1 - gone), transform: `translateX(${(1 - s) * 140 + gone * -80}px) scale(${1 - gone * 0.06})`, boxShadow: "0 9px 30px rgba(46,43,34,.05)" }}>
                <div style={{ display: "flex", gap: 18, fontFamily: MONO, fontSize: 16, color: "#8b8b82" }}>
                  <span>{it.time}</span><span>{it.app}</span><span>{it.dur}</span>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 16, color: "#a3a39b" }}><Pencil size={18} /><Clipboard size={18} /><Trash2 size={18} /></span>
                </div>
                <div style={{ marginTop: 10, fontSize: 27, fontWeight: 600, lineHeight: 1.35, color: "#3b3c35", letterSpacing: "-0.01em" }}>
                  <Highlight text={it.text} on={match ? hl : 0} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stored only on your PC */}
      {t > LOCAL_AT - 0.05 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 700, display: "flex", justifyContent: "center", opacity: Math.min(1, badge * 1.5), transform: `translateY(${(1 - badge) * 80}px) scale(${0.7 + 0.3 * badge})` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "26px 34px", borderRadius: 28, background: "#1d2a20f2", border: "2px solid #78a684aa", boxShadow: "0 30px 90px #000c, 0 0 80px #78a68433", color: C.white, fontFamily: FONT }}>
            <div style={{ width: 76, height: 76, borderRadius: 22, display: "grid", placeItems: "center", background: "#2d4935", color: "#94d4a4" }}><Laptop size={42} /></div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 42, letterSpacing: "-0.03em" }}>Stored only on your PC</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 21, color: "#94d4a4", marginTop: 6 }}>
                <CloudOff size={22} /> local SQLite · search works offline
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
