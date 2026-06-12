import { randomUUID } from "node:crypto";
import { hostname, platform } from "node:os";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { CaptureSession, KeyEvent } from "./types.js";

export class SessionRecorder {
  private session: CaptureSession;
  private readonly startMs: number;

  constructor() {
    this.startMs = Date.now();
    this.session = {
      sessionId: randomUUID(),
      startedAt: new Date(this.startMs).toISOString(),
      endedAt: null,
      environment: {
        platform: platform(),
        nodeVersion: process.version,
        hostname: hostname(),
      },
      totalEvents: 0,
      events: [],
    };
  }

  get sessionId(): string {
    return this.session.sessionId;
  }

  get eventCount(): number {
    return this.session.events.length;
  }

  record(event: Omit<KeyEvent, "timestamp" | "elapsedMs">): void {
    const now = Date.now();
    this.session.events.push({
      ...event,
      timestamp: new Date(now).toISOString(),
      elapsedMs: now - this.startMs,
    });
    this.session.totalEvents = this.session.events.length;
  }

  async save(outputPath: string): Promise<void> {
    this.session.endedAt = new Date().toISOString();
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(this.session, null, 2), "utf8");
  }
}
