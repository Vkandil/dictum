// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../lib/defaults";
import type { DictationState } from "../lib/types";
import Onboarding from "./Onboarding";
const bridge = vi.hoisted(() => {
  const listeners: ((state: DictationState) => void)[] = [];
  return { listeners, emit: (state: DictationState) => listeners.forEach(fn => fn(state)),
    listenDictation: vi.fn(async (fn: (s: DictationState) => void) => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }),
    localHardware: vi.fn(async () => ({ ramGb: 8, cpuThreads: 4, modelDirectory: "models" })), importLocalModel: vi.fn(), listenModelProgress: vi.fn(async () => () => {}), listLocalModels: vi.fn(async () => []), downloadLocalModel: vi.fn(), pauseLocalModel: vi.fn(), deleteLocalModel: vi.fn(), refreshProviderCatalog: vi.fn(), saveProvider: vi.fn(),
    isTauri: vi.fn(() => true), cancelRecording: vi.fn(), checkHotkey: vi.fn(), saveApiKey: vi.fn(), saveSettings: vi.fn(), startRecording: vi.fn(), startMicTest: vi.fn(), stopMicTest: vi.fn(), stopRecording: vi.fn(), validateApiKey: vi.fn(async () => ({ status: "authenticated", message: "ok" })),
  };
});
vi.mock("../lib/bridge", () => bridge);
const initial = () => ({ ...structuredClone(defaultSettings), uiLanguage: "en" as const });
async function reachTest() {
  fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
  await screen.findByRole("heading", { name: /your microphone/i });
  fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
  await screen.findByRole("heading", { name: /try your first dictation/i });
}
describe("guided onboarding", () => {
  beforeEach(() => { vi.clearAllMocks(); bridge.listeners.length = 0; bridge.isTauri.mockReturnValue(true); });
  afterEach(cleanup);
  it("requires a connection and does not let a local selection bypass engine readiness", async () => {
    render(<Onboarding initial={initial()} onComplete={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^continue/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /on this computer/i }));
    expect(screen.getByRole("button", { name: /^continue/i })).toBeDisabled();
    expect(bridge.validateApiKey).not.toHaveBeenCalled();
  });
  it("connects Mistral directly without an OpenRouter account", async () => {
    render(<Onboarding initial={initial()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /explore other options/i }));
    fireEvent.click(screen.getByRole("button", { name: /^mistral/i }));
    fireEvent.change(screen.getByLabelText(/Mistral API key/i), { target: { value: "fixture-key" } });
    fireEvent.click(screen.getByRole("button", { name: /verify connection/i }));
    await waitFor(() => expect(bridge.saveApiKey).toHaveBeenCalledWith("mistral", "fixture-key"));
    expect(bridge.validateApiKey).toHaveBeenCalledWith("mistral", "fixture-key", "https://api.mistral.ai/v1", "voxtral-mini-latest");
    expect(screen.getByRole("button", { name: /^continue/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    await screen.findByRole("heading", { name: /your microphone/i });
    fireEvent.click(screen.getByRole("button", { name: /^back/i }));
    expect(screen.getByText(/key already saved/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^continue/i })).toBeEnabled();
  });
  it("does not mark setup ready until a real dictation succeeds", async () => {
    const complete = vi.fn();
    render(<Onboarding initial={initial()} apiKeyHints={{ openrouter: "masked" }} onComplete={complete} />);
    await reachTest();
    expect(screen.getByRole("button", { name: /^start dictating/i })).toBeDisabled();
    act(() => bridge.emit({ phase: "result", text: "Unrelated event" }));
    expect(screen.getByRole("button", { name: /^start dictating/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /start test dictation/i }));
    await waitFor(() => expect(bridge.startRecording).toHaveBeenCalled());
    act(() => bridge.emit({ phase: "result", text: "Bonjour Dictum" }));
    expect(screen.getByLabelText("Test transcript")).toHaveValue("Bonjour Dictum");
    fireEvent.click(screen.getByRole("button", { name: /^start dictating/i }));
    await waitFor(() => expect(complete).toHaveBeenCalled());
    expect(bridge.saveSettings.mock.calls.at(-1)?.[0]).toMatchObject({ onboardingComplete: true, setupVerified: true });
  });
  it("offers deferred setup with an explicit incomplete state", async () => {
    const complete = vi.fn(); render(<Onboarding initial={initial()} onComplete={complete} />);
    fireEvent.click(screen.getByRole("button", { name: /set up later/i }));
    await waitFor(() => expect(complete).toHaveBeenCalled());
    expect(bridge.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ onboardingComplete: true, setupVerified: false }));
  });
  it("captures a shortcut and keeps unrelated recording errors off its page", async () => {
    render(<Onboarding initial={initial()} apiKeyHints={{ openrouter: "masked" }} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    await screen.findByRole("heading", { name: /your microphone/i });
    const capture = screen.getByRole("button", { name: /record shortcut/i }); fireEvent.click(capture); fireEvent.keyDown(capture, { code: "KeyD", ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(bridge.checkHotkey).toHaveBeenCalledWith("CommandOrControl+Shift+D"));
    act(() => bridge.emit({ phase: "error", message: "no speech detected" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("separates provider quota failures from a working microphone", async () => {
    render(<Onboarding initial={initial()} apiKeyHints={{ openrouter: "masked" }} onComplete={vi.fn()} />);
    await reachTest(); fireEvent.click(screen.getByRole("button", { name: /start test dictation/i }));
    await waitFor(() => expect(bridge.startRecording).toHaveBeenCalled());
    act(() => bridge.emit({ phase: "listening", level: 0.04 }));
    act(() => bridge.emit({ phase: "error", errorCode: "quota", message: "provider quota exhausted" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/credits|quota/i);
    expect(screen.getByText(/microphone is working/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^start dictating/i })).toBeDisabled();
  });
  it("keeps local readiness after selecting an installed model", async () => {
    const native = (await import("../../src-tauri/catalog/local-models.json")).default.find(m => m.id === "whisper-small")!;
    bridge.listLocalModels.mockResolvedValueOnce([{ model: native, installed: true, downloaded: 0, downloading: false }] as never);
    render(<Onboarding initial={initial()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /on this computer/i }));
    const title = await screen.findByText("Whisper Small", { selector: "strong" });
    fireEvent.click(within(title.closest("article")!).getByRole("button", { name: /selected/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^continue/i })).toBeEnabled());
  });
  it("supports a French setup without mixing spoken and interface language", async () => {
    render(<Onboarding initial={{ ...initial(), uiLanguage: "fr", language: "en" }} onComplete={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /comment voulez-vous/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /explorer les autres options/i })).toBeInTheDocument();
  });
});
