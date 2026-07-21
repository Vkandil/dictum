import { describe, expect, it } from "vitest";
import { displayShortcut, shortcutFromKeyEvent } from "./hotkey";

describe("shortcut capture", () => {
  it("turns a real Windows key press into Tauri shortcut syntax", () => {
    expect(shortcutFromKeyEvent({ code: "Space", ctrlKey: true, altKey: false, shiftKey: true })).toEqual({
      combo: "CommandOrControl+Shift+Space",
    });
    expect(displayShortcut("CommandOrControl+Shift+Space")).toBe("Ctrl + Shift + Space");
  });

  it("rejects ordinary typing keys and allows Escape to cancel", () => {
    expect(shortcutFromKeyEvent({ code: "KeyA", ctrlKey: false, altKey: false, shiftKey: false }).error).toMatch(/Include Ctrl/);
    expect(shortcutFromKeyEvent({ code: "Escape", ctrlKey: false, altKey: false, shiftKey: false })).toEqual({ cancelled: true });
  });
});
