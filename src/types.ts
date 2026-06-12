export type KeyCategory =
  | "char" // caractere imprimível (letras, números, símbolos)
  | "control" // tecla de controle (Enter, Tab, Backspace, etc.)
  | "special" // setas, F1-F12, etc.
  | "unknown";

export interface KeyEvent {
  /** Momento da captura em ISO-8601 (ex.: 2026-06-15T10:00:00.123Z). */
  timestamp: string;
  /** Milissegundos desde o início da sessão. */
  elapsedMs: number;
  /** Representação legível da tecla (ex.: "a", "Enter", "ArrowUp"). */
  key: string;
  /** Código bruto em bytes (hex), útil para teclas de controle. */
  raw: string;
  /** Categoria classificada da tecla. */
  category: KeyCategory;
}

/** Sessão completa de captura, é o que vai para o arquivo JSON. */
export interface CaptureSession {
  /** Identificador único da sessão. */
  sessionId: string;
  /** Início da sessão (ISO-8601). */
  startedAt: string;
  /** Fim da sessão (ISO-8601), preenchido ao encerrar. */
  endedAt: string | null;
  /** Informações do ambiente para fins didáticos. */
  environment: {
    platform: string;
    nodeVersion: string;
    hostname: string;
  };
  /** Total de teclas capturadas. */
  totalEvents: number;
  /** Lista de eventos capturados. */
  events: KeyEvent[];
}
