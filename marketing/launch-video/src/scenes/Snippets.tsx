import React from "react";
import { AbsoluteFill } from "remotion";
import { ArrowRight, Clock3, Keyboard, Mail } from "lucide-react";
import { C, FONT, MONO } from "../theme";
import { Hud } from "../components/Hud";
import { Win } from "../components/Win";
import { inExpo, inOut, level, rand, springAt, tween, useTime } from "../util";

// 23.5 → 28.0 s. "You can configure snippets. Say "my email" and your full address drops in."
// A: the Snippets page (same "When I say / Insert" form as src/routes/Snippets.tsx).
// B: using it — "my email" is spoken, the address expands in place, and the saving is counted.

const TRIGGER = "my email";
const ADDRESS = "alex.martin@company.com";

const Field: React.FC<{ label: string; children: React.ReactNode; w?: number }> = ({ label, children, w }) => (
  <div style={{ display: "grid", gap: 8, width: w }}>
    <span style={{ fontSize: 17, fontWeight: 700, color: "#55564e" }}>{label}</span>
    <div style={{ minHeight: 58, borderRadius: 12, border: "2px solid #d5d1c7", background: "#fffdfa", display: "flex", alignItems: "center", padding: "0 18px", fontSize: 25, fontWeight: 700, color: C.ink }}>{children}</div>
  </div>
);

const Saved: React.FC<{ icon: React.ReactNode; big: string; small: string; s: number }> = ({ icon, big, small, s }) => (
  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 18, padding: "22px 26px", borderRadius: 26, background: "#2d493566", border: "1.5px solid #78a68466", opacity: Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * 50}px) scale(${0.8 + 0.2 * s})` }}>
    <div style={{ color: "#94d4a4" }}>{icon}</div>
    <div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: C.white, letterSpacing: "-0.03em", lineHeight: 1.05 }}>{big}</div>
      <div style={{ fontFamily: MONO, fontSize: 19, color: "#94d4a4", marginTop: 4 }}>{small}</div>
    </div>
  </div>
);

export const Snippets: React.FC = () => {
  const t = useTime();
  if (t < 23.45 || t > 28.1) return null;
  const exit = tween(t, 27.88, 28.06, 0, 1, inExpo);

  // A — configure
  const pageIn = springAt(t, 23.5, { damping: 15, stiffness: 180 });
  const typed = Math.round(tween(t, 23.75, 24.15, 0, TRIGGER.length, inOut));
  const insertOn = tween(t, 24.25, 24.45);
  const pageOut = tween(t, 25.05, 25.25, 0, 1, inExpo);

  // B — use it
  const useIn = springAt(t, 25.1, { damping: 15, stiffness: 180 });
  const said = t > 25.55;
  const expand = tween(t, 26.4, 26.85, 0, 1, inOut);
  const shown = expand <= 0 ? TRIGGER : expand >= 1 ? ADDRESS : scramble(expand, t);
  const glow = t > 26.4 ? Math.exp(-(t - 26.85) * 3) : 0;
  const stat1 = springAt(t, 27.0, { damping: 12, stiffness: 220 });
  const stat2 = springAt(t, 27.15, { damping: 12, stiffness: 220 });

  return (
    <AbsoluteFill style={{ opacity: 1 - exit, transform: `translateX(${-exit * 600}px)`, filter: `blur(${exit * 14}px)` }}>
      <div style={{ position: "absolute", left: 90, top: 150, fontFamily: MONO, fontSize: 26, letterSpacing: "0.16em", color: C.orangeHi, opacity: tween(t, 23.5, 23.7) }}>SNIPPETS</div>

      {/* A — the Snippets page */}
      {pageOut < 1 ? (
        <div style={{ position: "absolute", left: 80, top: 210, width: 920, opacity: Math.min(1, pageIn * 1.5) * (1 - pageOut), transform: `translateY(${(1 - pageIn) * 200 - pageOut * 120}px) scale(${1 - pageOut * 0.1})` }}>
          <div style={{ borderRadius: 28, background: C.cream, padding: "34px 40px", fontFamily: FONT, color: C.ink, boxShadow: "0 40px 120px #000a" }}>
            <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 500, letterSpacing: "0.14em", color: C.orange }}>SAY LESS</div>
            <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.045em", marginTop: 4 }}>Snippets</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginTop: 26 }}>
              <Field label="When I say" w={290}>
                {TRIGGER.slice(0, typed)}
                {typed < TRIGGER.length && t > 23.7 ? <span style={{ width: 3, height: 30, background: C.orange, marginLeft: 2 }} /> : null}
              </Field>
              <div style={{ height: 58, display: "grid", placeItems: "center", color: C.orange }}><ArrowRight size={34} /></div>
              <div style={{ flex: 1, opacity: insertOn, transform: `translateX(${(1 - insertOn) * 30}px)` }}>
                <Field label="Insert">{ADDRESS}</Field>
              </div>
            </div>
          </div>
          {[
            { say: "meeting link", out: "meet.company.com/alex-weekly" },
            { say: "my signature", out: "Alex Martin · Head of Product · +33 6 12 34 56 78" },
          ].map((sn, i) => {
            const s = springAt(t, 24.5 + i * 0.14, { damping: 13, stiffness: 220 });
            return (
              <div key={sn.say} style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 22, padding: "22px 30px", borderRadius: 22, background: "#faf8f3", fontFamily: FONT, color: C.ink, boxShadow: "0 20px 50px #0007", opacity: Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * 60}px)` }}>
                <div style={{ minWidth: 250 }}>
                  <div style={{ fontFamily: MONO, fontSize: 15, color: "#8b8b82", letterSpacing: "0.08em" }}>SAY</div>
                  <div style={{ fontSize: 28, fontWeight: 800 }}>“{sn.say}”</div>
                </div>
                <div style={{ fontSize: 23, color: "#5d5e56", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sn.out}</div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* B — using it in a real reply */}
      {t > 25.05 ? (
        <>
          <div style={{ position: "absolute", left: 90, top: 210, opacity: Math.min(1, useIn * 1.5), transform: `translateY(${(1 - useIn) * 200}px)` }}>
            <Win title="Mail — Re: contract" width={900} height={430} icon={<Mail size={22} />}>
              <div style={{ padding: "30px 36px", fontSize: 36, fontWeight: 600, lineHeight: 1.45, color: C.ink, letterSpacing: "-0.01em" }}>
                Sure! Send the signed contract to{" "}
                {said ? (
                  <span style={{ display: "inline-block", fontWeight: 800, color: expand >= 1 ? "#2f6b43" : C.orange, background: expand >= 1 ? `rgba(120,166,132,${0.15 + 0.35 * glow})` : "#ef623a22", borderRadius: 10, padding: "0 8px", boxShadow: glow > 0 ? `0 0 ${40 * glow}px #78a684` : undefined, fontFamily: expand > 0 && expand < 1 ? MONO : FONT }}>
                    {shown}
                  </span>
                ) : null}
                <span style={{ display: "inline-block", width: 3, height: 40, marginLeft: 4, verticalAlign: "middle", background: C.orange, opacity: Math.sin(t * 12) > -0.2 ? 1 : 0 }} />
              </div>
            </Win>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 680, display: "flex", justifyContent: "center", opacity: Math.min(1, useIn * 1.5) }}>
            <Hud phase={t < 26.3 ? "listening" : "result"} level={level(t)} t={t} scale={1.7} width={420} text={t < 26.3 ? (said ? "“my email”" : "Listening") : "Snippet inserted"} />
          </div>
          <div style={{ position: "absolute", left: 90, right: 90, top: 840, display: "flex", gap: 18 }}>
            <Saved s={stat1} icon={<Keyboard size={44} />} big="2 words → 23 chars" small="you say less, it types it all" />
            <Saved s={stat2} icon={<Clock3 size={44} />} big="every. single. time." small="no copy-paste hunting" />
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/** Mid-expansion text: the trigger "rolls" into the address character by character. */
function scramble(k: number, t: number) {
  const n = Math.round(TRIGGER.length + (ADDRESS.length - TRIGGER.length) * k);
  const fixed = Math.floor(ADDRESS.length * k);
  const chars = "abcdefghijklmnopqrstuvwxyz.@";
  let out = ADDRESS.slice(0, fixed);
  for (let i = fixed; i < n; i++) out += chars[Math.floor(rand(i * 13 + Math.floor(t * 30)) * chars.length)];
  return out;
}
