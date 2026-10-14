import React from "react";
import { Composition, continueRender, delayRender, staticFile } from "remotion";
import { DictumLaunch } from "./Video";
import { DURATION_S, FPS, H, W } from "./theme";

const FONTS: [string, string, string][] = [
  ["Manrope", "400", "manrope-latin-400-normal.woff2"],
  ["Manrope", "500", "manrope-latin-500-normal.woff2"],
  ["Manrope", "600", "manrope-latin-600-normal.woff2"],
  ["Manrope", "700", "manrope-latin-700-normal.woff2"],
  ["Manrope", "800", "manrope-latin-800-normal.woff2"],
  ["DM Mono", "400", "dm-mono-latin-400-normal.woff2"],
  ["DM Mono", "500", "dm-mono-latin-500-normal.woff2"],
];

const handle = delayRender("fonts");
Promise.all(
  FONTS.map(([family, weight, file]) => {
    const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, { weight });
    document.fonts.add(face);
    return face.load();
  }),
).then(() => continueRender(handle));

export const Root: React.FC = () => (
  <Composition
    id="DictumLaunch"
    component={DictumLaunch}
    durationInFrames={Math.round(DURATION_S * FPS)}
    fps={FPS}
    width={W}
    height={H}
    defaultProps={{ audio: "mix.wav" }}
  />
);
