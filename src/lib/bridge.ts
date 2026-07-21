import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { browserBootstrap } from "./defaults";
import type { AppSettings, BootstrapData, DictationState, HistoryItem, ProviderManifest } from "./types";

export const isTauri = () => "__TAURI_INTERNALS__" in window;

export async function bootstrap(): Promise<BootstrapData> {
  return isTauri() ? invoke("bootstrap") : browserBootstrap;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (isTauri()) await invoke("save_settings", { settings });
}

export async function saveApiKey(provider: string, apiKey: string): Promise<void> {
  if (isTauri()) await invoke("save_api_key", { provider, apiKey });
  else await new Promise((resolve) => setTimeout(resolve, 350));
}

export async function validateApiKey(provider: string, apiKey?: string): Promise<void> {
  if (isTauri()) await invoke("validate_api_key", { provider, apiKey: apiKey || null });
  else await new Promise((resolve) => setTimeout(resolve, 500));
}

export async function setAutostart(enabled: boolean): Promise<void> {
  if (isTauri()) await invoke("set_autostart", { enabled });
}

export async function checkHotkey(combo: string): Promise<void> {
  if (isTauri()) await invoke("check_hotkey", { combo });
}

export async function startRecording(commandMode = false): Promise<void> {
  if (isTauri()) await invoke("start_recording", { commandMode });
}

export async function stopRecording(): Promise<void> {
  if (isTauri()) await invoke("stop_recording");
}

export async function cancelRecording(): Promise<void> {
  if (isTauri()) await invoke("cancel_recording");
}

export async function getHistory(search = ""): Promise<HistoryItem[]> {
  return isTauri() ? invoke("get_history", { search }) : [];
}

export async function deleteHistory(id?: number): Promise<void> {
  if (isTauri()) await invoke("delete_history", { id: id ?? null });
}

export async function copyText(text: string): Promise<void> {
  if (isTauri()) await invoke("copy_text", { text });
  else await navigator.clipboard.writeText(text);
}

export async function addDictionaryTerm(term: string): Promise<void> {
  if (isTauri()) await invoke("add_dictionary_term", { term });
}

export async function removeDictionaryTerm(id: number): Promise<void> {
  if (isTauri()) await invoke("remove_dictionary_term", { id });
}

export async function learnCorrection(original: string, corrected: string): Promise<string[]> {
  return isTauri() ? invoke("learn_correction", { original, corrected }) : [];
}

export async function saveSnippet(id: number | null, trigger: string, expansion: string): Promise<void> {
  if (isTauri()) await invoke("save_snippet", { id, trigger, expansion });
}

export async function removeSnippet(id: number): Promise<void> {
  if (isTauri()) await invoke("remove_snippet", { id });
}

export async function saveProvider(manifest: ProviderManifest): Promise<void> {
  if (isTauri()) await invoke("save_provider", { manifest });
}

export async function runSync(direction: "push" | "pull", password: string): Promise<void> {
  if (isTauri()) await invoke("run_sync", { direction, password });
}

export async function openPermissions(kind: "microphone" | "accessibility" | "inputMonitoring"): Promise<void> {
  if (isTauri()) await invoke("open_permissions", { kind });
}

export async function listenDictation(handler: (state: DictationState) => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => undefined;
  return listen<DictationState>("dictation:state", (event) => handler(event.payload));
}

export async function listenSettingsNavigation(handler: () => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => undefined;
  return listen("navigation:settings", handler);
}

export function windowLabel(): string {
  return isTauri() ? getCurrentWindow().label : new URLSearchParams(location.search).get("window") || "main";
}
