const KEY_NAMES: Record<string, string> = {
  Space: "Space",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Period: "Period",
  Comma: "Comma",
  Slash: "Slash",
  Backslash: "Backslash",
  Semicolon: "Semicolon",
  Quote: "Quote",
  Minus: "Minus",
  Equal: "Equal",
  Backquote: "Backquote",
  BracketLeft: "BracketLeft",
  BracketRight: "BracketRight",
};

export type ShortcutCapture = { combo?: string; error?: string; cancelled?: boolean };

export function shortcutFromKeyEvent(event: Pick<KeyboardEvent, "code" | "ctrlKey" | "altKey" | "shiftKey">): ShortcutCapture {
  if (event.code === "Escape") return { cancelled: true };
  if (["ControlLeft", "ControlRight", "MetaLeft", "MetaRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight"].includes(event.code)) return {};

  let key = KEY_NAMES[event.code];
  if (!key && event.code.startsWith("Key")) key = event.code.slice(3);
  if (!key && event.code.startsWith("Digit")) key = event.code.slice(5);
  if (!key && /^F([1-9]|1\d|2[0-4])$/.test(event.code)) key = event.code;
  if (!key) return { error: "That key cannot be used in a global shortcut." };

  const modifiers: string[] = [];
  if (event.ctrlKey) modifiers.push("CommandOrControl");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");
  if (!modifiers.length && !key.startsWith("F")) return { error: "Include Ctrl, Alt, or Command so the shortcut does not trigger while typing." };
  return { combo: [...modifiers, key].join("+") };
}

export function displayShortcut(combo: string): string {
  return combo
    .split("+")
    .map((part) => {
      if (part === "CommandOrControl" || part === "Control") return "Ctrl";
      return part;
    })
    .join(" + ");
}
