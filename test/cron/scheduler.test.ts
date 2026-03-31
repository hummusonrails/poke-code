import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CronScheduler } from "../../src/cron/scheduler.js";
import { CronStorage } from "../../src/cron/storage.js";

const FIXTURES_DIR = join(import.meta.dirname, "__fixtures__", "cron-scheduler");

describe("CronScheduler", () => {
  beforeEach(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  it("tick executes a due task and writes result log", async () => {
    const tasksPath = join(FIXTURES_DIR, "tasks.json");
    const resultsDir = join(FIXTURES_DIR, "results");
    mkdirSync(resultsDir, { recursive: true });

    const storage = new CronStorage(tasksPath);
    storage.add("test prompt", "* * * * *", FIXTURES_DIR, {});

    const executed: string[] = [];
    const scheduler = new CronScheduler({
      tasksPath,
      resultsDir,
      executePrompt: async (prompt: string, _cwd: string) => {
        executed.push(prompt);
        return "result text";
      },
    });

    await scheduler.tick();

    expect(executed).toEqual(["test prompt"]);

    const resultFiles = readdirSync(resultsDir);
    expect(resultFiles.length).toBe(1);
    const content = readFileSync(join(resultsDir, resultFiles[0]), "utf-8");
    expect(content).toContain("result text");
  });

  it("tick skips task already run this minute", async () => {
    const tasksPath = join(FIXTURES_DIR, "tasks.json");
    const resultsDir = join(FIXTURES_DIR, "results");
    mkdirSync(resultsDir, { recursive: true });

    const storage = new CronStorage(tasksPath);
    storage.add("test prompt", "* * * * *", FIXTURES_DIR, {});

    let execCount = 0;
    const scheduler = new CronScheduler({
      tasksPath,
      resultsDir,
      executePrompt: async () => {
        execCount++;
        return "ok";
      },
    });

    await scheduler.tick();
    await scheduler.tick();

    expect(execCount).toBe(1);
  });

  it("tick deletes one-shot task after execution", async () => {
    const tasksPath = join(FIXTURES_DIR, "tasks.json");
    const resultsDir = join(FIXTURES_DIR, "results");
    mkdirSync(resultsDir, { recursive: true });

    const storage = new CronStorage(tasksPath);
    storage.add("one time", "* * * * *", FIXTURES_DIR, { oneShot: true });

    const scheduler = new CronScheduler({
      tasksPath,
      resultsDir,
      executePrompt: async () => "done",
    });

    await scheduler.tick();

    const remaining = new CronStorage(tasksPath).list();
    expect(remaining).toHaveLength(0);
  });

  it("tick calls onResult callback when provided", async () => {
    const tasksPath = join(FIXTURES_DIR, "tasks.json");
    const resultsDir = join(FIXTURES_DIR, "results");
    mkdirSync(resultsDir, { recursive: true });

    const storage = new CronStorage(tasksPath);
    storage.add("callback test", "* * * * *", FIXTURES_DIR, {});

    const results: string[] = [];
    const scheduler = new CronScheduler({
      tasksPath,
      resultsDir,
      executePrompt: async () => "callback result",
      onResult: (_taskId, _prompt, result) => {
        results.push(result);
      },
    });

    await scheduler.tick();
    expect(results).toEqual(["callback result"]);
  });

  it("start and stop manage the interval", () => {
    const tasksPath = join(FIXTURES_DIR, "tasks.json");
    const resultsDir = join(FIXTURES_DIR, "results");
    mkdirSync(resultsDir, { recursive: true });

    const scheduler = new CronScheduler({
      tasksPath,
      resultsDir,
      executePrompt: async () => "ok",
    });

    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);

    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });
});
