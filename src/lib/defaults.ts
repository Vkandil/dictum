import type { AppSettings, BootstrapData } from "./types";
import providers from "../../src-tauri/catalog/providers.json";

export const defaultSettings: AppSettings = {
  uiLanguage: "auto",
  setupVerified: false,
  providerModels: {},
  providerEndpoints: {},
  onboardingComplete: false,
  provider: "openrouter",
  model: "mistralai/voxtral-mini-transcribe",
  localEndpoint: "http://localhost:8000/v1",
  hotkey: { mode: "hold", combo: "CommandOrControl+Shift+Space" },
  commandHotkey: "CommandOrControl+Shift+Period",
  language: "auto",
  microphoneId: null,
  injection: "clipboard",
  formatting: {
    provider: "openrouter",
    enabled: true,
    model: "mistralai/ministral-8b",
    removeFillers: true,
    fixGrammar: true,
    tone: "auto",
  },
  whisperMode: false,
  snippetsVerbatim: true,
  history: { enabled: true, retentionDays: 30, storeAudio: false },
  autostart: false,
  zeroRetention: true,
  fallbackProvider: null,
  allowCloudFallback: false,
  realtime: { enabled: false, provider: "mistral", model: "voxtral-mini-transcribe-realtime-2602" },
  sync: { enabled: false, endpoint: "", username: "" },
};

export const browserBootstrap: BootstrapData = {
  settings: defaultSettings,
  apiKeyHints: {},
  devices: [{ id: "default", name: "Default microphone", isDefault: true }],
  dictionary: [],
  snippets: [],
  version: "dev",
  providers,
};
