import { Easing, interpolate, spring, useCurrentFrame } from "remotion";
import envelope from "./envelope.json";
import { FPS } from "./theme";

/** Global time in seconds. Scenes are not wrapped in Sequences, so this is absolute. */
export const useTime = () => useCurrentFrame() / FPS;

export const outExpo = Easing.bezier(0.16, 1, 0.3, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);
export const inExpo = Easing.bezier(0.7, 0, 0.84, 0);
export const backOut = Easing.bezier(0.34, 1.56, 0.64, 1);

/** Map time t from [a, b] to [from, to], clamped, eased. */
export const tween = (t: number, a: number, b: number, from = 0, to = 1, easing = outExpo) =>
  interpolate(t, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

/** Physical spring that starts at time `start` (seconds). 0 before start. */
export const springAt = (t: number, start: number, config: { damping?: number; stiffness?: number; mass?: number } = {}) =>
  t < start ? 0 : spring({ frame: (t - start) * FPS, fps: FPS, config: { damping: 14, stiffness: 160, mass: 0.9, ...config } });

/** Voice loudness 0..1 at time t (precomputed RMS envelope). */
export const level = (t: number) => {
  const i = Math.max(0, Math.min(envelope.length - 1, Math.round(t * FPS)));
  return envelope[i] ?? 0;
};

/** Deterministic pseudo-random in [0, 1). */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Visibility window helper: 0 outside, 1 inside, with fades. */
export const windowed = (t: number, a: number, b: number, fadeIn = 0.15, fadeOut = 0.15) =>
  Math.min(tween(t, a, a + fadeIn, 0, 1, inOut), tween(t, b - fadeOut, b, 1, 0, inOut));
