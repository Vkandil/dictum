import { describe, expect, it } from "vitest";
import { browserBootstrap, defaultSettings } from "./defaults";

describe("privacy-preserving defaults", () => {
  it("never stores audio and requests zero retention", () => {
    expect(defaultSettings.history.storeAudio).toBe(false);
    expect(defaultSettings.zeroRetention).toBe(true);
  });

  it("defaults to the transcription model, never the TTS model", () => {
    expect(defaultSettings.model).toBe("mistralai/voxtral-mini-transcribe");
    expect(defaultSettings.model).not.toContain("tts");
  });

  it("ships interchangeable providers", () => {
    expect(browserBootstrap.providers.map((provider) => provider.id)).toEqual(["openrouter", "mistral", "local"]);
  });
});
