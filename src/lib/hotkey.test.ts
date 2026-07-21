import { describe, expect, it } from "vitest";
import { displayShortcut, shortcutFromKeyEvent } from "./hotkey";

describe("shortcut capture", () => {
  it("turns a real Windows key press into Tauri shortcut syntax", () => {
    expect(shortcutFromKeyEvent({ code: "Space", ctrlKey: true, metaKey: false, altKey: false, shiftKey: true }, false)).toEqual({
      combo: "CommandOrControl+Shift+Space",
    });
    expect(displayShortcut("CommandOrControl+Shift+Space", false)).toBe("Ctrl + Shift + Space");
  });

  it("rejects ordinary typing keys and allows Escape to cancel", () => {
    expect(shortcutFromKeyEvent({ code: "KeyA", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, false).error).toMatch(/Include Ctrl/);
    expect(shortcutFromKeyEvent({ code: "Escape", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, false)).toEqual({ cancelled: true });
  });
});
