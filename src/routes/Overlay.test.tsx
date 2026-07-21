// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DictationState } from "../lib/types";
import Overlay from "./Overlay";

const bridge = vi.hoisted(() => ({
  handler: undefined as ((state: DictationState) => void) | undefined,
  cancelRecording: vi.fn(),
  listenDictation: vi.fn(async (handler: (state: DictationState) => void) => {
    bridge.handler = handler;
    return () => undefined;
  }),
}));

vi.mock("../lib/bridge", () => bridge);

describe("dictation overlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bridge.handler = undefined;
  });
  afterEach(cleanup);

  it("shows progress while transcribing a multipart recording", async () => {
    render(<Overlay />);
    await waitFor(() => expect(bridge.handler).toBeTypeOf("function"));

    act(() => bridge.handler?.({
      phase: "transcribing",
      message: "Transcribing part 2 of 3",
    }));

    expect(screen.getByText("Transcribing part 2 of 3")).toBeInTheDocument();
  });
});
