import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionManager } from "../../src/session/manager.js";
import type { SessionEntry, SessionMeta } from "../../src/types.js";

const FIXTURES_DIR = join(import.meta.dirname, "__fixtures__", "session");

function tempDir(suffix: string): string {
  const dir = join(FIXTURES_DIR, suffix);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("SessionManager", () => {
  beforeEach(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  it("creates a session with correct metadata", () => {
    const manager = new SessionManager(tempDir("create"));
    const meta = manager.create("/home/user/project");
    expect(meta.id).toBeTruthy();
    expect(meta.cwd).toBe("/home/user/project");
    expect(meta.messageCount).toBe(0);
    expect(meta.startedAt).toBeTruthy();
    expect(meta.lastActiveAt).toBeTruthy();
  });

  it("creates a session with an optional label", () => {
    const manager = new SessionManager(tempDir("label"));
    const meta = manager.create("/tmp", "my session");
    expect(meta.label).toBe("my session");
  });

  it("lists created sessions", () => {
    const manager = new SessionManager(tempDir("list"));
    manager.create("/a");
    manager.create("/b");
    const sessions = manager.list();
    expect(sessions.length).toBe(2);
  });

  it("appends entries to JSONL and increments message count", () => {
    const manager = new SessionManager(tempDir("append"));
    const meta = manager.create("/tmp");
    const entry: SessionEntry = { role: "user", content: "hello world", timestamp: new Date().toISOString() };
    manager.append(meta.id, entry);
    const updated = manager.getSession(meta.id);
    expect(updated?.messageCount).toBe(1);
  });

  it("loads entries from JSONL file", () => {
    const manager = new SessionManager(tempDir("load-entries"));
    const meta = manager.create("/tmp");
    const entry1: SessionEntry = { role: "user", content: "message 1", timestamp: new Date().toISOString() };
    const entry2: SessionEntry = { role: "assistant", content: "response 1", timestamp: new Date().toISOString() };
    manager.append(meta.id, entry1);
    manager.append(meta.id, entry2);
    const entries = manager.loadEntries(meta.id);
    expect(entries.length).toBe(2);
    expect(entries[0].content).toBe("message 1");
    expect(entries[1].role).toBe("assistant");
  });

  it("returns empty array for nonexistent session", () => {
    const manager = new SessionManager(tempDir("missing-entries"));
    expect(manager.loadEntries("nonexistent-id")).toEqual([]);
  });

  it("returns the most recent session based on lastActiveAt", () => {
    const dir = tempDir("most-recent");
    const manager = new SessionManager(dir);
    const _s1 = manager.create("/a");
    const s2 = manager.create("/b");

    // Manually push a future lastActiveAt for s2 via index manipulation
    const indexPath = join(dir, "index.json");
    const index: SessionMeta[] = JSON.parse(readFileSync(indexPath, "utf-8"));
    const s2meta = index.find((s) => s.id === s2.id)!;
    s2meta.lastActiveAt = new Date(Date.now() + 60000).toISOString();
    writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");

    const recent = manager.getMostRecent();
    expect(recent?.id).toBe(s2.id);
  });

  it("returns null when no sessions exist", () => {
    const manager = new SessionManager(tempDir("empty"));
    expect(manager.getMostRecent()).toBeNull();
  });

  it("finds a session by id", () => {
    const manager = new SessionManager(tempDir("get-session"));
    const meta = manager.create("/tmp");
    const found = manager.getSession(meta.id);
    expect(found?.id).toBe(meta.id);
  });

  it("returns undefined for unknown session id", () => {
    const manager = new SessionManager(tempDir("unknown-id"));
    expect(manager.getSession("does-not-exist")).toBeUndefined();
  });

  it("lists sessions sorted by most recent lastActiveAt", () => {
    const dir = tempDir("sorted");
    const manager = new SessionManager(dir);
    const s1 = manager.create("/old");
    const s2 = manager.create("/new");

    // Manually set s2's lastActiveAt to be clearly in the future
    const indexPath = join(dir, "index.json");
    const index: SessionMeta[] = JSON.parse(readFileSync(indexPath, "utf-8"));
    const s2meta = index.find((s) => s.id === s2.id)!;
    s2meta.lastActiveAt = new Date(Date.now() + 60000).toISOString();
    writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");

    const list = manager.list();
    expect(list[0].id).toBe(s2.id);
    expect(list[1].id).toBe(s1.id);
  });
});
