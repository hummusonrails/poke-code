import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { CronTask } from "../types.js";

const MAX_TASKS = 50;
const DEFAULT_EXPIRY_DAYS = 14;

export class CronStorage {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  list(): CronTask[] {
    if (!existsSync(this.filePath)) return [];
    try {
      return JSON.parse(readFileSync(this.filePath, "utf-8"));
    } catch {
      return [];
    }
  }

  add(prompt: string, schedule: string, cwd: string, opts: { oneShot?: boolean; expiresAt?: string }): CronTask {
    const tasks = this.list();
    if (tasks.length >= MAX_TASKS) {
      throw new Error(`Maximum of 50 scheduled tasks reached. Remove some with /cron remove <id>.`);
    }

    const now = new Date();
    const task: CronTask = {
      id: randomUUID().slice(0, 8),
      prompt,
      schedule,
      createdAt: now.toISOString(),
      expiresAt: opts.oneShot
        ? null
        : (opts.expiresAt ?? new Date(now.getTime() + DEFAULT_EXPIRY_DAYS * 86400000).toISOString()),
      lastRunAt: null,
      runCount: 0,
      oneShot: opts.oneShot ?? false,
      cwd,
    };

    tasks.push(task);
    this.save(tasks);
    return task;
  }

  remove(id: string): boolean {
    const tasks = this.list();
    const filtered = tasks.filter((t) => t.id !== id);
    if (filtered.length === tasks.length) return false;
    this.save(filtered);
    return true;
  }

  update(id: string, updates: Partial<CronTask>): void {
    const tasks = this.list();
    const task = tasks.find((t) => t.id === id);
    if (task) {
      Object.assign(task, updates);
      this.save(tasks);
    }
  }

  purgeExpired(): number {
    const tasks = this.list();
    const now = Date.now();
    const kept = tasks.filter((t) => !t.expiresAt || new Date(t.expiresAt).getTime() > now);
    const purged = tasks.length - kept.length;
    if (purged > 0) this.save(kept);
    return purged;
  }

  private save(tasks: CronTask[]): void {
    writeFileSync(this.filePath, JSON.stringify(tasks, null, 2), "utf-8");
  }
}
