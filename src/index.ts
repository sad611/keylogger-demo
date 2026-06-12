import { resolve } from "node:path";
import { parseKey, toHex } from "./keyParser.js";
import { SessionRecorder } from "./sessionRecorder.js";


function resolveOutputPath(): string {
  const arg = process.argv[2];
  if (arg) {
    return resolve(process.cwd(), arg);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return resolve(process.cwd(), "logs", `session-${stamp}.json`);
}

function printBanner(outputPath: string, sessionId: string): void {
  console.log("=".repeat(64));
  console.log("  KEYLOGGER EDUCACIONAL — Demonstração de Malware (Cap. 6)");
  console.log("  Segurança Computacional · uso didático e autorizado");
  console.log("=".repeat(64));
  console.log(`  Sessão : ${sessionId}`);
  console.log(`  Saída  : ${outputPath}`);
  console.log("  Encerrar: Ctrl+C  |  Cada tecla é registrada abaixo");
  console.log("-".repeat(64));
}

async function main(): Promise<void> {
  const outputPath = resolveOutputPath();
  const recorder = new SessionRecorder();
  const stdin = process.stdin;

  if (!stdin.isTTY) {
    console.error(
      "Erro: o stdin não é um TTY. Rode em um terminal interativo real."
    );
    process.exit(1);
  }

  printBanner(outputPath, recorder.sessionId);

  // Sem setEncoding: o stdin emite Buffer por padrão, que é o que
  // parseKey espera. Definir um encoding faria "data" entregar strings.
  if (typeof stdin.setRawMode === "function") {
    stdin.setRawMode(true);
  }
  stdin.resume();

  const shutdown = async (): Promise<void> => {
    stdin.setRawMode(false);
    stdin.pause();
    try {
      await recorder.save(outputPath);
      console.log("\n" + "-".repeat(64));
      console.log(`  ${recorder.eventCount} evento(s) gravado(s).`);
      console.log(`  Arquivo JSON: ${outputPath}`);
      console.log("=".repeat(64));
    } catch (err) {
      console.error("Falha ao salvar o log:", err);
      process.exitCode = 1;
    }
    process.exit();
  };

  stdin.on("data", (data: Buffer) => {
    const { key, category } = parseKey(data);

    if (key === "Ctrl+C" || key === "Ctrl+D") {
      void shutdown();
      return;
    }

    recorder.record({ key, raw: toHex(data), category });

    const label = category === "char" ? key : `[${key}]`;
    process.stdout.write(label);
  });

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
