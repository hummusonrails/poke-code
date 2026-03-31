import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AutoDreamConfig, SessionEntry } from "../types.js";

export interface MemoryFile {
  filename: string;
  content: string;
}

export interface AutoDreamOptions {
  sessionsDir: string;
  memoryDir: string;
  statePath: string;
  lockPath: string;
  config: AutoDreamConfig;
  consolidate: (transcript: string) => Promise<MemoryFile[]>;
}

interface ConsolidationState {
  lastConsolidatedAt: string | null;
}

export class AutoDream {
  private options: AutoDreamOptions;

  constructor(options: AutoDreamOptions) {
    this.options = options;
  }

  shouldRun(): boolean {
    if (!this.options.config.enabled) return false;

    const state = this.loadState();
    const lastTime = state.lastConsolidatedAt ? new Date(state.lastConsolidatedAt).getTime() : 0;
    const hoursSince = (Date.now() - lastTime) / 3600000;

    if (hoursSince < this.options.config.minHours) return false;

    const recentSessions = this.countSessionsSince(lastTime);
    return recentSessions >= this.options.config.minSessions;
  }

  async run(): Promise<void> {
    // Lock check
    if (existsSync(this.options.lockPath)) {
      const pid = readFileSync(this.options.lockPath, "utf-8").trim();
      try {
        process.kill(parseInt(pid, 10), 0);
        return; // Another process is consolidating
      } catch {
        unlinkSync(this.options.lockPath);
      }
    }

    // Acquire lock
    writeFileSync(this.options.lockPath, String(process.pid), "utf-8");

    try {
      const state = this.loadState();
      const lastTime = state.lastConsolidatedAt ? new Date(state.lastConsolidatedAt).getTime() : 0;
      const transcript = this.buildTranscript(lastTime);

      if (!transcript) return;

      const memories = await this.options.consolidate(transcript);

      mkdirSync(this.options.memoryDir, { recursive: true });
      for (const mem of memories) {
        writeFileSync(join(this.options.memoryDir, mem.filename), mem.content, "utf-8");
      }

      this.saveState({ lastConsolidatedAt: new Date().toISOString() });
    } finally {
      if (existsSync(this.options.lockPath)) {
        try {
          unlinkSync(this.options.lockPath);
        } catch {
          /* ignore */
        }
      }
    }
  }

  private countSessionsSince(sinceMs: number): number {
    if (!existsSync(this.options.sessionsDir)) return 0;
    const files = readdirSync(this.options.sessionsDir).filter((f) => f.endsWith(".jsonl"));
    let count = 0;
    for (const file of files) {
      const stat = statSync(join(this.options.sessionsDir, file));
      if (stat.mtimeMs > sinceMs) count++;
    }
    return count;
  }

  private buildTranscript(sinceMs: number): string | null {
    if (!existsSync(this.options.sessionsDir)) return null;
    const files = readdirSync(this.options.sessionsDir).filter((f) => f.endsWith(".jsonl"));
    const parts: string[] = [];

    for (const file of files) {
      const filePath = join(this.options.sessionsDir, file);
      const stat = statSync(filePath);
      if (stat.mtimeMs <= sinceMs) continue;

      const raw = readFileSync(filePath, "utf-8").trim();
      if (!raw) continue;

      const entries: SessionEntry[] = raw
        .split("\n")
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      const messages = entries
        .filter((e) => e.role === "user" || e.role === "assistant")
        .map((e) => `${e.role}: ${e.content ?? ""}`)
        .join("\n");

      if (messages) {
        parts.push(`--- Session: ${file} ---\n${messages}`);
      }
    }

    return parts.length > 0 ? parts.join("\n\n") : null;
  }

  private loadState(): ConsolidationState {
    if (!existsSync(this.options.statePath)) return { lastConsolidatedAt: null };
    try {
      return JSON.parse(readFileSync(this.options.statePath, "utf-8"));
    } catch {
      return { lastConsolidatedAt: null };
    }
  }

  private saveState(state: ConsolidationState): void {
    writeFileSync(this.options.statePath, JSON.stringify(state, null, 2), "utf-8");
  }
}
