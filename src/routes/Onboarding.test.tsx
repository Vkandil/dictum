// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../lib/defaults";
import type { DictationState } from "../lib/types";
import Onboarding from "./Onboarding";

const bridge = vi.hoisted(() => ({
  listenHandler: undefined as ((state: DictationState) => void) | undefined,
  listenDictation: vi.fn(async (handler: (state: DictationState) => void) => {
    bridge.listenHandler = handler;
    return () => undefined;
  }),
  cancelRecording: vi.fn(),
  checkHotkey: vi.fn(),
  openPermissions: vi.fn(),
  saveApiKey: vi.fn(),
  saveSettings: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  validateApiKey: vi.fn(),
}));

vi.mock("../lib/bridge", () => bridge);

describe("onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bridge.listenHandler = undefined;
  });
  afterEach(cleanup);

  it("requires a validated hosted key but allows a genuinely local setup", async () => {
    const onComplete = vi.fn();
    render(<Onboarding initial={structuredClone(defaultSettings)} platform="windows" onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByRole("button", { name: /^continue/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /use a local provider/i }));
    expect(screen.getByText(/check your microphone/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    await screen.findByText(/give it a voice/i);
    fireEvent.click(screen.getByRole("button", { name: /finish setup/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(bridge.saveSettings.mock.calls.at(-1)?.[0]).toMatchObject({
      provider: "local",
      model: "mistralai/Voxtral-Mini-3B-2507",
      onboardingComplete: true,
    });
  });

  it("shows the test dictation result in its sandbox", async () => {
    render(<Onboarding initial={structuredClone(defaultSettings)} platform="windows" onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /use a local provider/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    await screen.findByText(/give it a voice/i);

    await waitFor(() => expect(bridge.listenHandler).toBeTypeOf("function"));
    act(() => bridge.listenHandler?.({ phase: "listening", level: 0.02 }));
    act(() => bridge.listenHandler?.({ phase: "result", text: "Hello from Voxtral" }));
    expect(screen.getByRole("textbox")).toHaveValue("Hello from Voxtral");
  });

  it("captures and validates a shortcut without typed syntax", async () => {
    render(<Onboarding initial={structuredClone(defaultSettings)} platform="windows" hasOpenRouterKey onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));

    const capture = screen.getByRole("button", { name: /record shortcut/i });
    fireEvent.click(capture);
    fireEvent.keyDown(capture, { code: "KeyD", ctrlKey: true, shiftKey: true });

    await waitFor(() => expect(bridge.checkHotkey).toHaveBeenCalledWith("CommandOrControl+Shift+D"));
    expect(screen.getAllByText("Ctrl + Shift + D")).toHaveLength(2);
    expect(screen.getByText(/available and selected/i)).toBeInTheDocument();
  });

  it("keeps delayed recording errors off the shortcut page and proceeds to the trial", async () => {
    render(<Onboarding initial={structuredClone(defaultSettings)} platform="windows" hasOpenRouterKey onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    await waitFor(() => expect(bridge.listenHandler).toBeTypeOf("function"));

    act(() => bridge.listenHandler?.({ phase: "error", errorCode: "empty_audio", message: "no speech detected" }));
    expect(screen.queryByText(/No speech was detected/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    await screen.findByText(/give it a voice/i);
    expect(screen.queryByText(/No speech was detected/i)).not.toBeInTheDocument();
  });

  it("shows live microphone activity and explains provider quota separately", async () => {
    render(<Onboarding initial={structuredClone(defaultSettings)} platform="windows" onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /use a local provider/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    await screen.findByText(/give it a voice/i);
    await waitFor(() => expect(bridge.listenHandler).toBeTypeOf("function"));

    fireEvent.click(screen.getByRole("button", { name: /start test dictation/i }));
    act(() => bridge.listenHandler?.({ phase: "listening", level: 0.04 }));
    expect(screen.getByRole("meter", { name: /microphone signal/i })).toHaveAttribute("aria-valuenow", "57");

    act(() => bridge.listenHandler?.({ phase: "error", errorCode: "quota", message: "provider quota exhausted" }));
    expect(screen.getByText(/API key was accepted/i)).toBeInTheDocument();
    expect(screen.getByText(/microphone is working/i)).toBeInTheDocument();
  });
});
