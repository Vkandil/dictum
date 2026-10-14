import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Check, Cloud, Copy, KeyRound, Laptop, Lock } from "lucide-react";
import { C, FONT, MONO } from "../theme";
import { Pointer } from "../components/Pointer";
import { inExpo, inOut, lerp, rand, springAt, tween, useTime } from "../util";

// 26.4 → 32.05 s. "Setup? Grab an OpenRouter key, paste it. Done. Pennies an hour. Or go fully local."

const Browser: React.FC<{ t: number }> = ({ t }) => {
  const created = t > 27.58;
  const copied = t > 28.0;
  const row = springAt(t, 27.58, { damping: 14, stiffness: 240 });
  const btnPress = t > 27.5 && t < 27.62 ? 0.94 : 1;
  return (
    <div style={{ width: 920, height: 560, borderRadius: 20, overflow: "hidden", background: "#ffffff", boxShadow: "0 40px 120px #000a", fontFamily: FONT }}>
      <div style={{ height: 70, background: "#ecebe7", display: "flex", alignItems: "center", gap: 16, padding: "0 22px" }}>
        {["#e5484d", "#f5a524", "#46a758"].map((c) => <div key={c} style={{ width: 16, height: 16, borderRadius: "50%", background: c, opacity: 0.85 }} />)}
        <div style={{ flex: 1, marginLeft: 12, height: 44, borderRadius: 22, background: "#fff", display: "flex", alignItems: "center", gap: 10, padding: "0 20px", fontSize: 23, color: "#444" }}>
          <Lock size={18} color="#777" /><span>openrouter.ai<span style={{ color: "#999" }}>/keys</span></span>
        </div>
      </div>
      <div style={{ padding: "40px 46px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 44, fontWeight: 800, color: "#111", letterSpacing: "-0.03em" }}>API Keys</div>
            <div style={{ fontSize: 22, color: "#777", marginTop: 4 }}>OpenRouter · one key, many models</div>
          </div>
          <div style={{ marginLeft: "auto", transform: `scale(${btnPress})`, background: "#111", color: "#fff", fontWeight: 700, fontSize: 24, padding: "16px 26px", borderRadius: 12 }}>Create Key</div>
        </div>
        <div style={{ marginTop: 40, borderTop: "1.5px solid #eee" }}>
          {[0, 1].map((r) => (
            <div key={r} style={{ display: "flex", alignItems: "center", gap: 20, padding: "22px 0", borderBottom: "1.5px solid #eee", opacity: r === 0 ? Math.min(1, row * 1.4) : 0.45, transform: r === 0 ? `translateY(${(1 - row) * -30}px)` : undefined, background: r === 0 && created ? `rgba(239,98,58,${0.08 * (1 - tween(t, 27.9, 28.3))})` : undefined }}>
              <KeyRound size={26} color="#555" />
              <div style={{ fontWeight: 700, fontSize: 25, color: "#222", width: 160 }}>{r === 0 ? "Dictum" : "old-key"}</div>
              <div style={{ fontFamily: MONO, fontSize: 23, color: "#555", flex: 1 }}>{r === 0 ? "sk-or-v1-8f3a••••••••c21e" : "sk-or-v1-••••••••••••"}</div>
              {r === 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 21, fontWeight: 700, padding: "10px 16px", borderRadius: 10, background: copied ? "#46a75822" : "#f3f3f3", color: copied ? "#2f7d3c" : "#333" }}>
                  {copied ? <Check size={20} /> : <Copy size={20} />} {copied ? "Copied" : "Copy"}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Onboarding: React.FC<{ t: number }> = ({ t }) => {
  const pasted = t > 28.56;
  const done = t > 29.1;
  const sweep = tween(t, 28.56, 28.8, 0, 1, inOut);
  const btn = done ? 1 : t > 28.98 ? 0.95 : 1;
  const steps = ["Welcome", "Connect", "Permissions", "Shortcut", "Try it"];
  return (
    <div style={{ width: 920, height: 600, borderRadius: 24, overflow: "hidden", background: C.cream, boxShadow: "0 40px 120px #000a", fontFamily: FONT, color: C.ink, padding: "34px 46px", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em" }}>
        <div style={{ width: 46, height: 46, borderRadius: "14px 14px 14px 5px", background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 6px 20px #24251f18" }}>
          <Img src={staticFile("logo.png")} style={{ width: "82%", height: "82%" }} />
        </div>
        Dictum
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 14, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: i === 1 ? C.ink : "#a3a39b" }}>
              <i style={{ fontStyle: "normal", width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", border: "1px solid #d2cec4", background: i === 1 ? C.ink : i === 0 ? "#e4eee6" : "transparent", color: i === 1 ? "#fff" : i === 0 ? "#4b7656" : undefined }}>{i === 0 ? "✓" : i + 1}</i>
              {i === 1 ? s : null}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 40, fontFamily: MONO, fontSize: 17, fontWeight: 500, letterSpacing: "0.14em", color: C.orange }}>STEP 1</div>
      <div style={{ fontSize: 58, fontWeight: 800, letterSpacing: "-0.045em", marginTop: 6 }}>Connect a service</div>
      <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
        {["OpenRouter", "Mistral"].map((p, i) => (
          <div key={p} style={{ padding: "12px 22px", borderRadius: 12, fontWeight: 700, fontSize: 22, border: `2px solid ${i === 0 ? C.orange : "#d9d5ca"}`, background: i === 0 ? "#fff" : "#ebe8df", color: i === 0 ? C.ink : "#77786f" }}>{p}</div>
        ))}
      </div>
      <div style={{ marginTop: 26, padding: 24, borderRadius: 18, background: C.paper, border: "1px solid #dedbd2", display: "flex", alignItems: "flex-end", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#55564e", marginBottom: 10 }}>OpenRouter API key</div>
          <div style={{ height: 58, borderRadius: 12, border: `2px solid ${pasted && !done ? "#e27657" : "#d5d1c7"}`, background: "#fffdfa", display: "flex", alignItems: "center", padding: "0 18px", fontFamily: MONO, fontSize: 24, color: pasted ? C.ink : "#b3b0a6", boxShadow: pasted && !done ? "0 0 0 5px #ef623a20" : undefined }}>
            {pasted ? (
              <span style={{ background: `linear-gradient(90deg, #ef623a33 ${sweep * 100}%, transparent ${sweep * 100}%)` }}>••••••••••••••••••••••••</span>
            ) : "sk-or-v1-…"}
          </div>
        </div>
        <div style={{ height: 58, padding: "0 26px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 22, color: "#fff", background: done ? "#55785e" : C.orange, transform: `scale(${btn})`, boxShadow: done ? "0 6px 20px #55785e55" : "0 6px 16px #ef623a2c" }}>
          {done ? <Check size={24} /> : null}
          {done ? "Connected" : "Validate key"}
        </div>
      </div>
      {done
        ? Array.from({ length: 14 }, (_, i) => {
            const k = Math.max(0, t - 29.12);
            const a = rand(i) * Math.PI * 2;
            const d = 60 + rand(i + 3) * 200;
            return <div key={i} style={{ position: "absolute", left: 755 + Math.cos(a) * d * Math.min(1, k * 4), top: 400 + Math.sin(a) * d * Math.min(1, k * 4) + k * k * 300, width: 12, height: 12, borderRadius: i % 2 ? 3 : "50%", background: [C.orange, "#94d4a4", C.blueHi][i % 3], opacity: Math.max(0, 1 - k * 1.6) }} />;
          })
        : null}
    </div>
  );
};

export const Setup: React.FC = () => {
  const t = useTime();
  if (t < 26.35 || t > 32.15) return null;
  const exit = tween(t, 31.9, 32.1, 0, 1, inExpo);

  // "Setup?" title: big, then docks to the top.
  const title = springAt(t, 26.42, { damping: 12, stiffness: 200 });
  const dock = tween(t, 26.95, 27.25, 0, 1, inOut);
  const titleOut = tween(t, 29.45, 29.6);

  // Panel strip: 0 browser, 1 onboarding.
  const panelIn = springAt(t, 27.0, { damping: 15, stiffness: 170 });
  const pan = tween(t, 28.3, 28.5, 0, 1, inOut);
  const panelsOut = tween(t, 29.45, 29.65, 0, 1, inExpo);
  const blur = Math.sin(pan * Math.PI) * 14;

  // Pointer path (screen coordinates).
  const px = t < 27.5 ? lerp(1000, 860, tween(t, 27.1, 27.45, 0, 1, inOut)) : t < 28.3 ? lerp(860, 890, tween(t, 27.7, 27.95, 0, 1, inOut)) : lerp(700, 835, tween(t, 28.6, 28.92, 0, 1, inOut));
  const py = t < 27.5 ? lerp(1150, 510, tween(t, 27.1, 27.45, 0, 1, inOut)) : t < 28.3 ? lerp(510, 645, tween(t, 27.7, 27.95, 0, 1, inOut)) : lerp(1060, 750, tween(t, 28.6, 28.92, 0, 1, inOut));
  const click = t > 27.48 && t < 27.78 ? (t - 27.48) / 0.3 : t > 27.98 && t < 28.28 ? (t - 27.98) / 0.3 : t > 28.96 && t < 29.26 ? (t - 28.96) / 0.3 : 0;
  const pointerOn = t > 27.05 && t < 29.4 && !(t > 28.28 && t < 28.55);

  // Price
  const price = springAt(t, 29.55, { damping: 12, stiffness: 190 });
  const priceOut = tween(t, 30.68, 30.85, 0, 1, inExpo);
  // Local toggle
  const local = springAt(t, 30.78, { damping: 14, stiffness: 200 });
  const knob = tween(t, 31.0, 31.25, 0, 1, inOut);

  return (
    <AbsoluteFill style={{ opacity: 1 - exit, transform: `translateY(${-exit * 300}px)`, filter: `blur(${exit * 12}px)` }}>
      {/* Title */}
      <div style={{ position: "absolute", left: 0, right: 0, top: lerp(420, 110, dock), textAlign: "center", opacity: Math.min(1, title * 1.5) * (1 - titleOut), transform: `scale(${(0.6 + 0.4 * title) * lerp(1, 0.42, dock)})`, fontFamily: FONT, fontWeight: 800, fontSize: 200, letterSpacing: "-0.06em", color: C.white, lineHeight: 1 }}>
        Setup<span style={{ color: C.orange }}>?</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 660, display: "flex", justifyContent: "center", opacity: tween(t, 26.6, 26.8) * (1 - dock) }}>
        <div style={{ fontFamily: MONO, fontSize: 32, color: C.cream, padding: "14px 26px", borderRadius: 999, border: "1.5px solid #ffffff2a", background: "#ffffff0d" }}>≈ 1 minute. No subscription.</div>
      </div>

      {/* Panels */}
      {t > 26.95 && t < 29.7 ? (
        <div style={{ position: "absolute", left: 0, top: 360, width: 1080, opacity: Math.min(1, panelIn * 1.5) * (1 - panelsOut), transform: `translateY(${(1 - panelIn) * 300 + panelsOut * 200}px)`, filter: `blur(${blur}px)` }}>
          <div style={{ position: "absolute", left: 80 - pan * 1080, top: 0 }}><Browser t={t} /></div>
          <div style={{ position: "absolute", left: 80 + (1 - pan) * 1080, top: -20 }}><Onboarding t={t} /></div>
        </div>
      ) : null}
      {pointerOn ? <Pointer x={px} y={py} click={click} /> : null}

      {/* Pennies an hour */}
      {t > 29.5 && t < 30.9 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 340, textAlign: "center", opacity: Math.min(1, price * 1.5) * (1 - priceOut), transform: `scale(${(0.6 + 0.4 * price) * (1 + priceOut * 0.4)})`, fontFamily: FONT, color: C.white }}>
          <div style={{ fontFamily: MONO, fontSize: 30, color: "#ffffff88", textDecoration: "line-through", textDecorationColor: C.orange, textDecorationThickness: 4 }}>$15 / month subscription</div>
          <div style={{ fontWeight: 800, fontSize: 280, letterSpacing: "-0.07em", lineHeight: 1.05, marginTop: 20 }}>
            ~$0.18
          </div>
          <div style={{ fontWeight: 700, fontSize: 64, letterSpacing: "-0.03em", color: C.orangeHi, marginTop: -10 }}>per hour of talking</div>
          <div style={{ fontFamily: MONO, fontSize: 24, color: "#ffffff70", marginTop: 34 }}>$0.003 / min · Voxtral via OpenRouter · pay as you go</div>
        </div>
      ) : null}

      {/* Or go fully local */}
      {t > 30.7 ? (
        <div style={{ position: "absolute", left: 90, right: 90, top: 360, opacity: Math.min(1, local * 1.5), transform: `translateY(${(1 - local) * 160}px)` }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 120, letterSpacing: "-0.055em", color: C.white, lineHeight: 1, marginBottom: 50 }}>
            or fully <span style={{ color: "#94d4a4" }}>local.</span>
          </div>
          {[
            { icon: <Cloud size={44} />, name: "Cloud", sub: "OpenRouter · Mistral", on: 1 - knob },
            { icon: <Laptop size={44} />, name: "Local / vLLM", sub: "localhost:8000 · no key needed", on: knob },
          ].map((o, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 26, padding: "30px 34px", marginBottom: 22, borderRadius: 28, background: o.on > 0.5 ? (i ? "#2d493588" : "#ffffff12") : "#ffffff08", border: `2px solid ${o.on > 0.5 ? (i ? "#78a684aa" : "#ffffff30") : "#ffffff12"}`, color: C.white, fontFamily: FONT, boxShadow: i && o.on > 0.5 ? "0 0 70px #78a68433" : undefined }}>
              <div style={{ color: i ? "#94d4a4" : "#ffffffaa" }}>{o.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 42, letterSpacing: "-0.03em" }}>{o.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 23, color: "#ffffff80", marginTop: 4 }}>{o.sub}</div>
              </div>
              <div style={{ width: 104, height: 58, borderRadius: 29, background: o.on > 0.5 ? (i ? "#55785e" : "#ffffff40") : "#ffffff18", position: "relative" }}>
                <div style={{ position: "absolute", top: 7, left: 7 + 46 * o.on, width: 44, height: 44, borderRadius: "50%", background: "#fff", boxShadow: "0 3px 8px #0006" }} />
              </div>
            </div>
          ))}
          <div style={{ fontFamily: MONO, fontSize: 26, color: "#94d4a4", textAlign: "center", marginTop: 20, opacity: tween(t, 31.3, 31.55) }}>nothing leaves your PC</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
