import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PokeApiClient } from "../api/client.js";
import { ConfigStore } from "../config/store.js";
import { ContextBuilder } from "../context/builder.js";
import { CronScheduler } from "../cron/scheduler.js";
import { canImsgSend, imsgSend } from "../db/imsg-sender.js";
import { ToolRegistry } from "../tools/registry.js";

const configDir = join(homedir(), ".poke");
const pidPath = join(configDir, "daemon.pid");

export async function startDaemon(): Promise<void> {
  const store = new ConfigStore(configDir);
  const config = store.load();
  const apiKey = store.resolveApiKey();

  if (!apiKey) {
    console.error("Error: No API key configured. Run poke-code --init first.");
    process.exit(1);
  }

  // Check if already running
  if (existsSync(pidPath)) {
    const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
    try {
      process.kill(pid, 0);
      console.error(`Daemon already running (PID ${pid}). Use: poke-code --daemon stop`);
      process.exit(1);
    } catch {
      // Stale PID, continue
    }
  }

  // Write PID
  writeFileSync(pidPath, String(process.pid), "utf-8");

  const apiClient = new PokeApiClient(apiKey);
  const registry = new ToolRegistry();
  const useImsg = config.chatId ? await canImsgSend() : false;

  const scheduler = new CronScheduler({
    tasksPath: join(configDir, "scheduled_tasks.json"),
    resultsDir: join(configDir, "cron-results"),
    executePrompt: async (prompt: string, cwd: string) => {
      const builder = new ContextBuilder(registry, cwd, configDir);
      const fullMessage = builder.build(prompt);
      const response = await apiClient.sendMessage(fullMessage);
      return response.message ?? "Message sent.";
    },
    imsgSend: useImsg && config.chatId
      ? (text: string) => imsgSend(config.chatId!, text)
      : undefined,
  });

  scheduler.start();
  console.log(`poke-code daemon started (PID ${process.pid})`);
  console.log(`Tasks: ${join(configDir, "scheduled_tasks.json")}`);
  console.log(`Results: ${join(configDir, "cron-results/")}`);
  console.log(`Log: ${join(configDir, "daemon.log")}`);

  // Graceful shutdown
  const cleanup = () => {
    scheduler.stop();
    if (existsSync(pidPath)) unlinkSync(pidPath);
    console.log("Daemon stopped.");
    process.exit(0);
  };
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
}

export function stopDaemon(): void {
  if (!existsSync(pidPath)) {
    console.log("Daemon is not running.");
    return;
  }

  const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
  try {
    process.kill(pid, "SIGTERM");
    console.log(`Sent SIGTERM to daemon (PID ${pid}).`);
  } catch {
    console.log(`Daemon process ${pid} not found. Cleaning up stale PID file.`);
  }
  unlinkSync(pidPath);
}

export function daemonStatus(): void {
  if (!existsSync(pidPath)) {
    console.log("Daemon is not running.");
    return;
  }

  const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
  try {
    process.kill(pid, 0);
    console.log(`Daemon is running (PID ${pid}).`);
  } catch {
    console.log(`Daemon is not running (stale PID file for ${pid}).`);
    unlinkSync(pidPath);
  }
}
