import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseNaturalSchedule } from "../../src/cron/natural-schedule.js";
import { CronScheduler } from "../../src/cron/scheduler.js";
import { CronStorage } from "../../src/cron/storage.js";

const FIXTURES_DIR = join(import.meta.dirname, "__fixtures__", "cron-integration");

describe("cron integration", () => {
  beforeEach(() => {
    mkdirSync(join(FIXTURES_DIR, "results"), { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  it("natural language → storage → scheduler → result log", async () => {
    // 1. Parse natural language
    const parsed = parseNaturalSchedule("every minute");
    expect(parsed).not.toBeNull();
    expect(parsed?.cron).toBe("* * * * *");

    // 2. Store the task
    const tasksPath = join(FIXTURES_DIR, "tasks.json");
    const storage = new CronStorage(tasksPath);
    const task = storage.add("integration test prompt", parsed?.cron, FIXTURES_DIR, {
      oneShot: parsed?.oneShot,
    });
    expect(storage.list()).toHaveLength(1);

    // 3. Scheduler ticks and executes
    const scheduler = new CronScheduler({
      tasksPath,
      resultsDir: join(FIXTURES_DIR, "results"),
      executePrompt: async (prompt) => `Executed: ${prompt}`,
    });

    await scheduler.tick();

    // 4. Verify result log was written
    const resultFiles = readdirSync(join(FIXTURES_DIR, "results"));
    expect(resultFiles.length).toBe(1);
    expect(resultFiles[0]).toContain(task.id);

    // 5. Verify task was updated
    const updated = storage.list()[0];
    expect(updated.runCount).toBe(1);
    expect(updated.lastRunAt).toBeTruthy();
  });
});
