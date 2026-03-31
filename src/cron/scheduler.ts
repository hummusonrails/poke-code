import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CronExpressionParser } from "cron-parser";
import { CronStorage } from "./storage.js";

export interface CronSchedulerOptions {
  tasksPath: string;
  resultsDir: string;
  executePrompt: (prompt: string, cwd: string) => Promise<string>;
  onResult?: (taskId: string, prompt: string, result: string) => void;
  imsgSend?: (text: string) => Promise<void>;
}

export class CronScheduler {
  private options: CronSchedulerOptions;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(options: CronSchedulerOptions) {
    this.options = options;
  }

  start(): void {
    if (this.interval) return;
    // Align to next minute boundary
    const now = Date.now();
    const msToNextMinute = 60000 - (now % 60000);
    setTimeout(() => {
      this.tick();
      this.interval = setInterval(() => this.tick(), 60000);
    }, msToNextMinute);
    // Use a sentinel so isRunning() works immediately
    this.interval = this.interval ?? setInterval(() => {}, 2_147_483_647);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  isRunning(): boolean {
    return this.interval !== null;
  }

  async tick(): Promise<void> {
    const storage = new CronStorage(this.options.tasksPath);
    storage.purgeExpired();
    const tasks = storage.list();
    const now = new Date();

    for (const task of tasks) {
      // Dedup: skip if already ran this minute
      if (task.lastRunAt) {
        const lastRun = new Date(task.lastRunAt);
        if (
          lastRun.getFullYear() === now.getFullYear() &&
          lastRun.getMonth() === now.getMonth() &&
          lastRun.getDate() === now.getDate() &&
          lastRun.getHours() === now.getHours() &&
          lastRun.getMinutes() === now.getMinutes()
        ) {
          continue;
        }
      }

      // Check if cron expression matches current minute
      try {
        const expr = CronExpressionParser.parse(task.schedule, { currentDate: new Date(now.getTime() - 60000) });
        const next = expr.next().toDate();
        if (next.getHours() !== now.getHours() || next.getMinutes() !== now.getMinutes()) {
          continue;
        }
      } catch {
        continue;
      }

      // Execute
      try {
        const result = await this.options.executePrompt(task.prompt, task.cwd);

        // Write result log
        mkdirSync(this.options.resultsDir, { recursive: true });
        const timestamp = now.toISOString().replace(/[:.]/g, "-");
        const logPath = join(this.options.resultsDir, `${task.id}-${timestamp}.log`);
        writeFileSync(
          logPath,
          `Prompt: ${task.prompt}\nSchedule: ${task.schedule}\nRan at: ${now.toISOString()}\n\n${result}`,
          "utf-8",
        );

        // Update task state
        storage.update(task.id, { lastRunAt: now.toISOString(), runCount: task.runCount + 1 });

        // Callbacks
        if (this.options.onResult) {
          this.options.onResult(task.id, task.prompt, result);
        }
        if (this.options.imsgSend && !this.options.onResult) {
          try {
            await this.options.imsgSend(`[Cron] ${task.prompt}\n\n${result.slice(0, 4000)}`);
          } catch {
            /* best-effort */
          }
        }

        // Delete one-shot tasks after execution
        if (task.oneShot) {
          storage.remove(task.id);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[cron] Error executing task ${task.id}: ${msg}\n`);
      }
    }
  }
}
