import type { AppSettings, ProviderManifest } from "./types";
export function chooseProvider(settings: AppSettings, provider: ProviderManifest): AppSettings {
  const native = provider.protocol === "native", model = (settings.provider === provider.id ? settings.model : settings.providerModels[provider.id]) ?? provider.models[0];
  const chat = provider.chatModels?.[0];
  return { ...settings, provider: provider.id, model, setupVerified: false, realtime: { ...settings.realtime, enabled: false },
    providerModels: { ...settings.providerModels, [settings.provider]: settings.model, [provider.id]: model },
    formatting: { ...settings.formatting, enabled: native ? false : Boolean(chat) && settings.formatting.enabled, provider: native ? null : chat ? provider.id : settings.formatting.provider, model: chat ?? settings.formatting.model },
  };
}
export function modelName(provider: ProviderManifest | undefined, id: string) { return provider?.modelInfo?.find(m => m.id === id)?.name ?? id; }
export function liveModels(provider: ProviderManifest | undefined) { return provider?.modelInfo?.filter(m => m.live) ?? []; }
export function onDevice(provider: ProviderManifest | undefined, endpoint?: string) {
  if (provider?.protocol === "native") return true;
  try { return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(endpoint ?? provider?.baseUrl ?? "").hostname); } catch { return false; }
}
