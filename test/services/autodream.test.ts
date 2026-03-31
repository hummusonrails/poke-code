import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AutoDream } from "../../src/services/autodream.js";

const FIXTURES_DIR = join(import.meta.dirname, "__fixtures__", "autodream");

function writeSession(dir: string, id: string, entries: object[]): void {
  const content = `${entries.map((e) => JSON.stringify(e)).join("\n")}\n`;
  writeFileSync(join(dir, `${id}.jsonl`), content, "utf-8");
}

describe("AutoDream", () => {
  beforeEach(() => {
    mkdirSync(join(FIXTURES_DIR, "sessions"), { recursive: true });
    mkdirSync(join(FIXTURES_DIR, "memory", "autodream"), { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  it("shouldRun returns false when disabled", () => {
    const dream = new AutoDream({
      sessionsDir: join(FIXTURES_DIR, "sessions"),
      memoryDir: join(FIXTURES_DIR, "memory", "autodream"),
      statePath: join(FIXTURES_DIR, "consolidation-state.json"),
      lockPath: join(FIXTURES_DIR, "consolidation.lock"),
      config: { enabled: false, minHours: 24, minSessions: 5 },
      consolidate: async () => [],
    });
    expect(dream.shouldRun()).toBe(false);
  });

  it("shouldRun returns false when not enough sessions", () => {
    for (let i = 0; i < 2; i++) {
      writeSession(join(FIXTURES_DIR, "sessions"), `session-${i}`, [
        { role: "user", content: "hello", timestamp: new Date().toISOString() },
      ]);
    }

    const dream = new AutoDream({
      sessionsDir: join(FIXTURES_DIR, "sessions"),
      memoryDir: join(FIXTURES_DIR, "memory", "autodream"),
      statePath: join(FIXTURES_DIR, "consolidation-state.json"),
      lockPath: join(FIXTURES_DIR, "consolidation.lock"),
      config: { enabled: true, minHours: 0, minSessions: 5 },
      consolidate: async () => [],
    });
    expect(dream.shouldRun()).toBe(false);
  });

  it("shouldRun returns true when thresholds met", () => {
    for (let i = 0; i < 6; i++) {
      writeSession(join(FIXTURES_DIR, "sessions"), `session-${i}`, [
        { role: "user", content: "hello", timestamp: new Date().toISOString() },
      ]);
    }

    const dream = new AutoDream({
      sessionsDir: join(FIXTURES_DIR, "sessions"),
      memoryDir: join(FIXTURES_DIR, "memory", "autodream"),
      statePath: join(FIXTURES_DIR, "consolidation-state.json"),
      lockPath: join(FIXTURES_DIR, "consolidation.lock"),
      config: { enabled: true, minHours: 0, minSessions: 5 },
      consolidate: async () => [],
    });
    expect(dream.shouldRun()).toBe(true);
  });

  it("run consolidates and writes memory files", async () => {
    for (let i = 0; i < 6; i++) {
      writeSession(join(FIXTURES_DIR, "sessions"), `session-${i}`, [
        { role: "user", content: `message ${i}`, timestamp: new Date().toISOString() },
        { role: "assistant", content: `response ${i}`, timestamp: new Date().toISOString() },
      ]);
    }

    const dream = new AutoDream({
      sessionsDir: join(FIXTURES_DIR, "sessions"),
      memoryDir: join(FIXTURES_DIR, "memory", "autodream"),
      statePath: join(FIXTURES_DIR, "consolidation-state.json"),
      lockPath: join(FIXTURES_DIR, "consolidation.lock"),
      config: { enabled: true, minHours: 0, minSessions: 5 },
      consolidate: async (_transcript: string) => [
        { filename: "patterns.md", content: "# Patterns\n\nUser likes short responses." },
      ],
    });

    await dream.run();

    expect(existsSync(join(FIXTURES_DIR, "memory", "autodream", "patterns.md"))).toBe(true);
    const content = readFileSync(join(FIXTURES_DIR, "memory", "autodream", "patterns.md"), "utf-8");
    expect(content).toContain("Patterns");

    const state = JSON.parse(readFileSync(join(FIXTURES_DIR, "consolidation-state.json"), "utf-8"));
    expect(state.lastConsolidatedAt).toBeTruthy();
  });

  it("run respects file lock", async () => {
    for (let i = 0; i < 6; i++) {
      writeSession(join(FIXTURES_DIR, "sessions"), `session-${i}`, [
        { role: "user", content: "hello", timestamp: new Date().toISOString() },
      ]);
    }

    // Create lock file with current PID (simulates another process consolidating)
    writeFileSync(join(FIXTURES_DIR, "consolidation.lock"), String(process.pid), "utf-8");

    let called = false;
    const dream = new AutoDream({
      sessionsDir: join(FIXTURES_DIR, "sessions"),
      memoryDir: join(FIXTURES_DIR, "memory", "autodream"),
      statePath: join(FIXTURES_DIR, "consolidation-state.json"),
      lockPath: join(FIXTURES_DIR, "consolidation.lock"),
      config: { enabled: true, minHours: 0, minSessions: 5 },
      consolidate: async () => {
        called = true;
        return [];
      },
    });

    await dream.run();
    expect(called).toBe(false);
  });
});
