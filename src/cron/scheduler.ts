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
  private startTimeout: ReturnType<typeof setTimeout> | null = null;
  private loopTimeout: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(options: CronSchedulerOptions) {
    this.options = options;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    // Align to next minute boundary (0 if already on boundary)
    const now = Date.now();
    const msToNextMinute = (60000 - (now % 60000)) % 60000;
    this.startTimeout = setTimeout(() => {
      this.startTimeout = null;
      this.runLoop();
    }, msToNextMinute);
  }

  private async runLoop(): Promise<void> {
    if (!this.running) return;
    await this.tick();
    if (!this.running) return;
    this.loopTimeout = setTimeout(() => this.runLoop(), 60000);
  }

  stop(): void {
    this.running = false;
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
    if (this.loopTimeout) {
      clearTimeout(this.loopTimeout);
      this.loopTimeout = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  async tick(): Promise<void> {
    const storage = new CronStorage(this.options.tasksPath);
    storage.purgeExpired();
    const tasks = storage.list();
    const now = new Date();
    const nowMinute = Math.floor(now.getTime() / 60000);

    for (const task of tasks) {
      // Dedup: skip if already ran this minute
      if (task.lastRunAt) {
        const lastRunMinute = Math.floor(new Date(task.lastRunAt).getTime() / 60000);
        if (lastRunMinute === nowMinute) {
          continue;
        }
      }

      // Check if cron expression matches current minute
      try {
        const expr = CronExpressionParser.parse(task.schedule, { currentDate: new Date(now.getTime() - 60000) });
        const next = expr.next().toDate();
        // Compare full timestamp truncated to minute, not just HH:mm
        if (Math.floor(next.getTime() / 60000) !== nowMinute) {
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
