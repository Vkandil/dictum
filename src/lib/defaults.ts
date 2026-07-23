import type { AppSettings, BootstrapData } from "./types";

export const defaultSettings: AppSettings = {
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
    enabled: true,
    model: "mistralai/ministral-8b",
    removeFillers: true,
    fixGrammar: true,
    tone: "auto",
    fastInsert: false,
  },
  whisperMode: false,
  snippetsVerbatim: true,
  history: { enabled: true, retentionDays: 30, storeAudio: false },
  autostart: false,
  zeroRetention: true,
  fallbackProvider: null,
  realtime: { enabled: false, provider: "mistral", model: "voxtral-mini-transcribe-realtime-2602" },
  sync: { enabled: false, endpoint: "", username: "" },
};

export const browserBootstrap: BootstrapData = {
  settings: defaultSettings,
  hasApiKey: {},
  devices: [{ id: "default", name: "Default microphone", isDefault: true }],
  dictionary: [],
  snippets: [],
  version: "dev",
  providers: [
    {
      id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1",
      transcriptionPath: "/audio/transcriptions", chatPath: "/chat/completions",
      models: ["mistralai/voxtral-mini-transcribe", "mistralai/voxtral-small-24b-2507"],
      supportsRealtime: false, requiresApiKey: true,
    },
    {
      id: "mistral", name: "Mistral", baseUrl: "https://api.mistral.ai/v1",
      transcriptionPath: "/audio/transcriptions", chatPath: "/chat/completions",
      models: ["voxtral-mini-latest", "voxtral-mini-transcribe-realtime-2602"],
      supportsRealtime: true, requiresApiKey: true,
    },
    {
      id: "local", name: "Local / vLLM", baseUrl: "http://localhost:8000/v1",
      transcriptionPath: "/audio/transcriptions", chatPath: "/chat/completions",
      models: ["mistralai/Voxtral-Mini-3B-2507"], supportsRealtime: true, requiresApiKey: false,
    },
  ],
};
