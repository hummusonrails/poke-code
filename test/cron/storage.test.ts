import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CronStorage } from "../../src/cron/storage.js";

const FIXTURES_DIR = join(import.meta.dirname, "__fixtures__", "cron-storage");

describe("CronStorage", () => {
  beforeEach(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  it("returns empty array when no tasks file exists", () => {
    const storage = new CronStorage(join(FIXTURES_DIR, "tasks.json"));
    expect(storage.list()).toEqual([]);
  });

  it("adds a task and persists it", () => {
    const storage = new CronStorage(join(FIXTURES_DIR, "tasks.json"));
    const task = storage.add("check build", "*/30 * * * *", "/home/user/project", {});
    expect(task.id).toBeTruthy();
    expect(task.prompt).toBe("check build");
    expect(task.schedule).toBe("*/30 * * * *");
    expect(task.cwd).toBe("/home/user/project");
    expect(task.oneShot).toBe(false);
    expect(task.runCount).toBe(0);
    expect(task.lastRunAt).toBeNull();
    expect(task.expiresAt).toBeTruthy();

    const reloaded = new CronStorage(join(FIXTURES_DIR, "tasks.json"));
    expect(reloaded.list()).toHaveLength(1);
    expect(reloaded.list()[0].id).toBe(task.id);
  });

  it("adds a one-shot task", () => {
    const storage = new CronStorage(join(FIXTURES_DIR, "tasks.json"));
    const task = storage.add("morning report", "0 9 * * *", "/tmp", { oneShot: true });
    expect(task.oneShot).toBe(true);
    expect(task.expiresAt).toBeNull();
  });

  it("removes a task by id", () => {
    const storage = new CronStorage(join(FIXTURES_DIR, "tasks.json"));
    const task = storage.add("check build", "*/30 * * * *", "/tmp", {});
    expect(storage.remove(task.id)).toBe(true);
    expect(storage.list()).toHaveLength(0);
  });

  it("returns false when removing nonexistent task", () => {
    const storage = new CronStorage(join(FIXTURES_DIR, "tasks.json"));
    expect(storage.remove("nonexistent")).toBe(false);
  });

  it("updates a task", () => {
    const storage = new CronStorage(join(FIXTURES_DIR, "tasks.json"));
    const task = storage.add("check build", "*/30 * * * *", "/tmp", {});
    const now = new Date().toISOString();
    storage.update(task.id, { lastRunAt: now, runCount: 1 });
    const updated = storage.list().find((t) => t.id === task.id)!;
    expect(updated.lastRunAt).toBe(now);
    expect(updated.runCount).toBe(1);
  });

  it("enforces 50 task limit", () => {
    const storage = new CronStorage(join(FIXTURES_DIR, "tasks.json"));
    for (let i = 0; i < 50; i++) {
      storage.add(`task ${i}`, "* * * * *", "/tmp", {});
    }
    expect(() => storage.add("one too many", "* * * * *", "/tmp", {})).toThrow("Maximum of 50");
  });

  it("purges expired tasks", () => {
    const storage = new CronStorage(join(FIXTURES_DIR, "tasks.json"));
    const task = storage.add("old task", "* * * * *", "/tmp", {});
    storage.update(task.id, { expiresAt: "2020-01-01T00:00:00Z" } as any);
    const purged = storage.purgeExpired();
    expect(purged).toBe(1);
    expect(storage.list()).toHaveLength(0);
  });
});
