import { describe, expect, it } from "vitest";
import { browserBootstrap, defaultSettings } from "./defaults";
import { chooseProvider, liveModels, onDevice } from "./providers";
describe("provider selection", () => {
  it("remembers each provider's model without losing the previous choice", () => {
    const openai = browserBootstrap.providers.find(p => p.id === "openai")!, router = browserBootstrap.providers.find(p => p.id === "openrouter")!;
    const previous = { ...defaultSettings, model: "openai/whisper-large-v3-turbo" };
    const switched = chooseProvider(previous, openai);
    expect(chooseProvider(switched, router).model).toBe(previous.model);
  });
  it("disables cloud clean-up when switching to on-device dictation", () => {
    const native = browserBootstrap.providers.find(p => p.id === "offline")!;
    const next = chooseProvider(defaultSettings, native);
    expect(next.formatting.enabled).toBe(false); expect(next.formatting.provider).toBeNull();
  });
  it("distinguishes remote servers from actual on-device execution", () => {
    const server = browserBootstrap.providers.find(p => p.id === "local")!;
    expect(onDevice(server, "https://speech.example.com/v1")).toBe(false);
    expect(onDevice(server, "http://localhost:8000/v1")).toBe(true);
  });
  it("does not offer batch models in the live selector", () => {
    const mistral = browserBootstrap.providers.find(p => p.id === "mistral")!;
    expect(liveModels(mistral).map(m => m.id)).toEqual(["voxtral-mini-transcribe-realtime-2602"]);
  });
});
