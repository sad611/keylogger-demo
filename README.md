# Keylogger Educacional (CLI)

Projeto de demonstração para o **Seminário de Segurança Computacional** —
Capítulo 6 "Software Malicioso (malware)" de *Computer Security: Principles
and Practice*, 4ª ed. (Stallings & Brown).

> **Aviso legal:** Uso exclusivamente didático e autorizado. Esta ferramenta
> captura apenas as teclas digitadas **no próprio terminal onde é executada**.
> Ela **não** instala hooks globais no sistema operacional nem monitora outras
> aplicações. Capturar teclas de terceiros sem consentimento é crime (no
> Brasil, Lei 12.737/2012 — "Lei Carolina Dieckmann" — e LGPD).

---

## O que demonstra

Um keylogger é um tipo de **spyware** (Stallings, Cap. 6) que registra as
teclas digitadas pela vítima para capturar credenciais e dados sensíveis.
Este protótipo ilustra os conceitos centrais de forma controlada:

1. **Captura de input** — terminal em *raw mode* (`process.stdin`).
2. **Interpretação de teclas** — bytes brutos → teclas legíveis (incluindo
   sequências de escape ANSI para setas e F-keys).
3. **Persistência** — eventos gravados em **JSON estruturado** com timestamp.
4. **Exfiltração em rede** — arquitetura C2 (Command & Control) simulada via
   TCP, com servidor do atacante recebendo eventos em tempo real.

---

## Estrutura

```
src/
  index.ts            # Modo local: orquestra captura e gravação de sessão
  keyParser.ts        # Interpreta bytes do stdin em teclas legíveis
  sessionRecorder.ts  # Acumula eventos e grava o JSON da sessão
  types.ts            # Tipos compartilhados (KeyEvent, CaptureSession)
  protocol.ts         # Definição do protocolo C2 (JSON-lines sobre TCP)
  victim.ts           # Cliente C2: captura teclas e exfiltra via socket
  attacker.ts         # Servidor C2: recebe eventos e extrai credenciais
```

---

## Como rodar

```bash
npm install
```

### Modo 1 — Log local

Captura as teclas no terminal e grava um arquivo JSON ao encerrar.

```bash
# Desenvolvimento (sem build):
npm run dev

# Saída customizada:
npm run dev -- meu-log.json

# Build + execução:
npm run build
npm start
```

Digite algumas teclas e pressione **Ctrl+C** para encerrar. O log é
gravado em `./logs/session-<timestamp>.json`.

---

### Modo 2 — C2 em rede (attacker + victim)

Simula a arquitetura real de um keylogger com exfiltração remota: o processo
`victim` captura as teclas e as envia via TCP para o servidor `attacker`, que
as exibe em tempo real e extrai pares de credenciais (email + senha).

**Requer dois terminais abertos simultaneamente.**

#### Terminal 1 — Atacante (`attacker`)

```bash
npm run attacker
```

- Abre um servidor TCP na porta `4444` (localhost).
- Aguarda a conexão da vítima.
- Exibe cada tecla recebida com timestamp, categoria e bytes brutos.
- Reconstrói palavras digitadas e detecta automaticamente pares
  **email → senha** usando regex.
- Salva as credenciais encontradas em `./logs/credentials.json`.

#### Terminal 2 — Vítima (`victim`)

```bash
npm run victim
```

- Conecta ao servidor do atacante em `127.0.0.1:4444`.
- Envia um **handshake** com informações do ambiente (hostname, plataforma,
  versão do Node).
- Captura cada tecla em raw mode e a transmite imediatamente via socket,
  no formato JSON-lines: `{ "type": "key", "event": { ... } }`.
- Pressione **Ctrl+C** para enviar mensagem de desconexão e encerrar.

#### Formato das credenciais capturadas (`logs/credentials.json`)

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

## Formato do log de sessão (Modo 1)

```json
{
  "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "startedAt": "2026-06-15T10:00:00.000Z",
  "endedAt": "2026-06-15T10:00:12.345Z",
  "environment": {
    "platform": "win32",
    "nodeVersion": "v20.11.0",
    "hostname": "PC-DEMO"
  },
  "totalEvents": 3,
  "events": [
    { "timestamp": "2026-06-15T10:00:01.100Z", "elapsedMs": 1100, "key": "s",     "raw": "73", "category": "char"    },
    { "timestamp": "2026-06-15T10:00:01.300Z", "elapsedMs": 1300, "key": "e",     "raw": "65", "category": "char"    },
    { "timestamp": "2026-06-15T10:00:01.800Z", "elapsedMs": 1800, "key": "Enter", "raw": "0d", "category": "control" }
  ]
}
```

---
