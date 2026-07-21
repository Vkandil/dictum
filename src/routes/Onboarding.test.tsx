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
    expect(screen.getByText(/two permissions/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /finish setup/i }));

    await waitFor(() => expect(bridge.saveSettings).toHaveBeenCalled());
    expect(bridge.saveSettings.mock.calls[0][0]).toMatchObject({
      provider: "local",
      model: "mistralai/Voxtral-Mini-3B-2507",
      onboardingComplete: true,
    });
    expect(onComplete).toHaveBeenCalled();
  });

  it("shows the test dictation result in its sandbox", async () => {
    render(<Onboarding initial={structuredClone(defaultSettings)} platform="windows" onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /use a local provider/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));

    await waitFor(() => expect(bridge.listenHandler).toBeTypeOf("function"));
    act(() => bridge.listenHandler?.({ phase: "result", text: "Hello from Voxtral" }));
    expect(screen.getByRole("textbox")).toHaveValue("Hello from Voxtral");
  });
});
