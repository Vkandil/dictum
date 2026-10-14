// Render review stills at given seconds: node stills.mjs 0.5 4.9 ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const times = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browserExecutable = process.env.REMOTION_BROWSER || undefined;
const inputProps = { audio: "" };
const composition = await selectComposition({ serveUrl, id: "DictumLaunch", inputProps, browserExecutable });
for (const s of times) {
  const frame = Math.round(s * composition.fps);
  await renderStill({ composition, serveUrl, output: `out/stills/${s.toFixed(2)}.png`, frame, inputProps, browserExecutable, scale: 0.5 });
  console.log("still", s);
}
