export type ProviderId = "openrouter" | "mistral" | "local" | string;
export type HotkeyMode = "hold" | "toggle" | "doubleTap";
export type Tone = "auto" | "formal" | "casual" | "code";
export type InjectionMode = "clipboard" | "keystroke";

export interface FormattingSettings {
  enabled: boolean;
  model: string;
  removeFillers: boolean;
  fixGrammar: boolean;
  tone: Tone;
  fastInsert: boolean;
}

export interface AppSettings {
  onboardingComplete: boolean;
  provider: ProviderId;
  model: string;
  localEndpoint: string;
  hotkey: { mode: HotkeyMode; combo: string };
  commandHotkey: string;
  language: string;
  microphoneId: string | null;
  injection: InjectionMode;
  formatting: FormattingSettings;
  whisperMode: boolean;
  history: { enabled: boolean; retentionDays: number; storeAudio: false };
  autostart: boolean;
  zeroRetention: boolean;
  fallbackProvider: ProviderId | null;
  realtime: { enabled: boolean; provider: ProviderId; model: string };
  sync: { enabled: boolean; endpoint: string; username: string };
}

export interface HistoryItem {
  id: number;
  text: string;
  rawText?: string | null;
  appBundle?: string | null;
  audioMs: number;
  costUsd: number;
  model: string;
  createdAt: number;
}

export interface DictionaryTerm {
  id: number;
  term: string;
  source: "manual" | "auto";
  createdAt: number;
}

export interface Snippet {
  id: number;
  trigger: string;
  expansion: string;
}

export interface AudioDevice { id: string; name: string; isDefault: boolean }

export interface ProviderManifest {
  id: string;
  name: string;
  baseUrl: string;
  transcriptionPath: string;
  chatPath: string;
  models: string[];
  supportsRealtime: boolean;
  requiresApiKey: boolean;
}

export interface BootstrapData {
  settings: AppSettings;
  hasApiKey: Record<string, boolean>;
  devices: AudioDevice[];
  dictionary: DictionaryTerm[];
  snippets: Snippet[];
  providers: ProviderManifest[];
  platform: string;
  version: string;
}

export type DictationPhase = "idle" | "listening" | "transcribing" | "formatting" | "result" | "error" | "cancelled";

export interface DictationState {
  phase: DictationPhase;
  level?: number;
  message?: string;
  text?: string;
  errorCode?: string;
}
