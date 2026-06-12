# Keylogger Educacional (CLI)

Projeto de demonstração para o **Seminário de Segurança Computacional** —
Capítulo 6 "Software Malicioso (malware)" de *Computer Security: Principles
and Practice*, 4ª ed. (Stallings & Brown).

> ⚠️ **Uso exclusivamente didático e autorizado.** Esta ferramenta captura
> apenas as teclas digitadas **no próprio terminal onde é executada**. Ela
> **não** instala hooks globais no sistema operacional nem monitora outras
> aplicações. Capturar teclas de terceiros sem consentimento é crime (no
> Brasil, Lei 12.737/2012 — "Lei Carolina Dieckmann" — e LGPD).

## O que demonstra

Um keylogger é um tipo de **spyware** (Stallings, Cap. 6) que registra as
teclas digitadas pela vítima para capturar credenciais e dados sensíveis.
Este protótipo ilustra os conceitos centrais de forma controlada:

1. **Captura de input** — terminal em *raw mode* (`process.stdin`).
2. **Interpretação de teclas** — bytes brutos → teclas legíveis (incluindo
   sequências de escape ANSI para setas e F-keys).
3. **Persistência** — eventos gravados em **JSON estruturado** com timestamp.

## Estrutura

```
src/
  index.ts            # Ponto de entrada: orquestra captura e encerramento
  keyParser.ts        # Interpreta bytes do stdin em teclas legíveis
  sessionRecorder.ts  # Acumula eventos e grava o JSON da sessão
  types.ts            # Tipos compartilhados (KeyEvent, CaptureSession)
```

## Como rodar

```bash
npm install

# Desenvolvimento (sem build, via tsx):
npm run dev

# Saída customizada:
npm run dev -- meu-log.json

# Build + execução:
npm run build
npm start
```

Digite algumas teclas e pressione **Ctrl+C** para encerrar. O log será
gravado em `./logs/session-<timestamp>.json` (ou no caminho informado).

## Formato do log (JSON)

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
    { "timestamp": "2026-06-15T10:00:01.100Z", "elapsedMs": 1100, "key": "s", "raw": "73", "category": "char" },
    { "timestamp": "2026-06-15T10:00:01.300Z", "elapsedMs": 1300, "key": "e", "raw": "65", "category": "char" },
    { "timestamp": "2026-06-15T10:00:01.800Z", "elapsedMs": 1800, "key": "Enter", "raw": "0d", "category": "control" }
  ]
}
```

## Roteiro sugerido para a apresentação (9 min)

1. **Definição (2 min):** o que é um keylogger, onde se encaixa na taxonomia
   de malware do Stallings (spyware / coleta de informação).
2. **Modelagem e ferramentas (3 min):** raw mode do terminal, interpretação
   de bytes, vetores reais (hooks de SO, drivers, hardware USB).
3. **Demonstração (4 min):** rodar `npm run dev`, digitar texto, encerrar e
   abrir o JSON gerado mostrando os dados capturados.

## Defesas (para fechar a apresentação)

- Teclados virtuais / *on-screen keyboards* para credenciais.
- Antimalware com detecção comportamental e *anti-keylogging*.
- Autenticação multifator (MFA) — reduz o valor de senhas capturadas.
- Princípio do menor privilégio e monitoramento de processos suspeitos.
