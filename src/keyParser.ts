import type { KeyCategory } from "./types.js";

interface ParsedKey {
  key: string;
  category: KeyCategory;
}

const CONTROL_KEYS: Record<number, string> = {
  0x03: "Ctrl+C",
  0x04: "Ctrl+D",
  0x08: "Backspace",
  0x09: "Tab",
  0x0d: "Enter",
  0x1b: "Escape",
  0x7f: "Backspace",
};

/** Sequências de escape comuns (ANSI) para teclas especiais. */
const ESCAPE_SEQUENCES: Record<string, string> = {
  "[A": "ArrowUp",
  "[B": "ArrowDown",
  "[C": "ArrowRight",
  "[D": "ArrowLeft",
  "[H": "Home",
  "[F": "End",
  "[3~": "Delete",
  "[5~": "PageUp",
  "[6~": "PageDown",
  "OP": "F1",
  "OQ": "F2",
  "OR": "F3",
  "OS": "F4",
};

/**
 * Interpreta um Buffer de tecla vindo do stdin.
 *
 * @param data Buffer lido do stdin em modo raw.
 * @returns Tecla interpretada com seu nome legível e categoria.
 */
export function parseKey(data: Buffer): ParsedKey {
  const str = data.toString("utf8");

  // 1) Sequência de escape (setas, F-keys, etc.)
  if (str.length > 1 && str.charCodeAt(0) === 0x1b) {
    const mapped = ESCAPE_SEQUENCES[str];
    if (mapped) {
      return { key: mapped, category: "special" };
    }
    return { key: "Escape-Seq", category: "special" };
  }

  if (data.length === 1) {
    const byte = data[0];
    const control = CONTROL_KEYS[byte];
    if (control) {
      return { key: control, category: "control" };
    }

    if (byte >= 0x20 && byte <= 0x7e) {
      return { key: str, category: "char" };
    }
  }

  if (str.length >= 1 && str.charCodeAt(0) >= 0x20) {
    return { key: str, category: "char" };
  }

  return { key: str, category: "unknown" };
}

export function toHex(data: Buffer): string {
  return data.toString("hex").replace(/(..)/g, "$1 ").trim();
}
