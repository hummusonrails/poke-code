#!/usr/bin/env node
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { PokeApiClient } from "../src/api/client.js";
import { renderApp } from "../src/app.js";
import { ConfigStore } from "../src/config/store.js";
import { copyClaudeConfig } from "../src/config/wizard.js";
import type { PermissionMode } from "../src/types.js";

function promptForInput(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runSetupWizard(store: ConfigStore, _configDir: string): Promise<void> {
  const home = homedir();
  const claudeDir = join(home, ".claude");

  console.log("\n  ╭────────────────────────────────────╮");
  console.log("  │     🌴 Poke Code Setup Wizard      │");
  console.log("  ╰────────────────────────────────────╯\n");

  // Step 1: Copy Claude config
  if (existsSync(claudeDir)) {
    const pokeDir = join(home, ".poke");
    if (!existsSync(join(pokeDir, "rules")) && !existsSync(join(pokeDir, "memory"))) {
      console.log("  Found ~/.claude/ — importing rules and memory...");
      copyClaudeConfig(claudeDir, pokeDir);
      console.log("  Done. CLAUDE.md files renamed to POKE.md.\n");
    }
  }

  // Step 2: API key
  console.log("  Step 1: API Key");
  console.log("  Get your key from https://poke.com/kitchen → API Keys\n");

  const currentKey = store.resolveApiKey();
  if (currentKey && currentKey !== "test-key") {
    console.log(`  Current key: ${currentKey.slice(0, 8)}...${currentKey.slice(-4)}`);
    const change = await promptForInput("  Change it? (y/N): ");
    if (change.toLowerCase() !== "y") {
      console.log("  Keeping existing key.\n");
    } else {
      const newKey = await promptForInput("  New API key: ");
      if (newKey) {
        store.update({ apiKey: newKey });
        console.log("  API key updated.\n");
      }
    }
  } else {
    const envKey = process.env.POKE_API_KEY;
    if (envKey) {
      store.update({ apiKey: envKey });
      console.log("  API key loaded from POKE_API_KEY env var.\n");
    } else {
      const key = await promptForInput("  Poke API key: ");
      if (key) {
        store.update({ apiKey: key });
        console.log("  API key saved.\n");
      } else {
        console.log("  Skipped. Set POKE_API_KEY or run poke-code --init later.\n");
      }
    }
  }

  // Step 3: Select Poke handle from chat.db
  console.log("  Step 2: iMessage Contact");
  console.log("  Select your Poke contact to receive responses in the terminal.\n");

  const dbPath = join(home, "Library", "Messages", "chat.db");
  if (!existsSync(dbPath)) {
    console.log("  ⚠ Could not find ~/Library/Messages/chat.db");
    console.log("  Make sure Full Disk Access is granted to your terminal app.");
    console.log("  You can set chatId/handleId manually in ~/.poke/config.json\n");
  } else {
    try {
      const { ChatDbPoller } = await import("../src/db/poller.js");
      const poller = new ChatDbPoller(dbPath);
      const handles = poller.fetchRecentHandles();
      poller.close();

      if (handles.length === 0) {
        console.log("  No recent iMessage conversations found.\n");
      } else {
        console.log("  Recent iMessage contacts:\n");
        const displayHandles = handles.slice(0, 15);
        for (let i = 0; i < displayHandles.length; i++) {
          console.log(`    ${i + 1}. ${displayHandles[i].identifier}`);
        }
        console.log();

        const choice = await promptForInput("  Select Poke contact (number): ");
        const idx = parseInt(choice, 10) - 1;
        if (idx >= 0 && idx < displayHandles.length) {
          const selected = displayHandles[idx];
          store.update({
            handleId: selected.rowId,
            chatId: selected.chatId,
            handleIdentifier: selected.identifier,
          });
          console.log(`  Selected: ${selected.identifier}`);
          console.log("  chatId and handleId saved.\n");
        } else {
          console.log("  Invalid selection. You can re-run poke-code --init later.\n");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠ Could not read Messages database: ${msg}`);
      console.log("");
      console.log("  To fix this, grant Full Disk Access to your terminal app:");
      console.log("    System Settings → Privacy & Security → Full Disk Access");
      console.log("    Then add your terminal (e.g. Terminal, iTerm2, Ghostty, etc.)");
      console.log("");
      console.log("  After granting access, run: poke-code --init");
      console.log("");
      await promptForInput("  Press Enter to continue without response polling...");
    }
  }

  console.log("  ✓ Setup complete! Run poke-code to start.\n");
}

async function main(): Promise<void> {
  const argv = await yargs(hideBin(process.argv))
    .scriptName("poke-code")
    .usage("Usage: poke-code [message] [options]")
    .positional("message", {
      type: "string",
      describe: "Message to send (one-shot mode)",
    })
    .option("init", {
      type: "boolean",
      describe: "Run the setup wizard",
    })
    .option("resume", {
      type: "string",
      describe: "Resume a previous session by ID",
    })
    .option("continue", {
      type: "boolean",
      describe: "Continue the most recent session",
    })
    .option("permission-mode", {
      type: "string",
      choices: ["default", "trusted", "readonly"] as const,
      describe: "Tool permission mode",
      default: "default",
    })
    .option("system-prompt", {
      type: "string",
      describe: "Override the system prompt",
    })
    .option("output-format", {
      type: "string",
      choices: ["text", "json", "stream-json"] as const,
      describe: "Output format for one-shot mode",
      default: "text",
    })
    .option("add-dir", {
      type: "array",
      string: true,
      describe: "Additional directories to expose",
    })
    .option("verbose", {
      type: "boolean",
      alias: "v",
      describe: "Show verbose tool output",
    })
    .option("no-tools", {
      type: "boolean",
      describe: "Disable all tool execution",
    })
    .option("p", {
      type: "boolean",
      describe: "One-shot / pipe mode (same as providing a message argument)",
    })
    .option("daemon", {
      type: "string",
      choices: ["start", "stop", "status"] as const,
      describe: "Manage the background cron daemon",
    })
    .help()
    .alias("help", "h")
    .parse();

  const configDir = join(homedir(), ".poke");
  const store = new ConfigStore(configDir);

  // --init: run full setup wizard
  if (argv.init) {
    await runSetupWizard(store, configDir);
    process.exit(0);
  }

  // First-run: if no API key or no chatId, run setup wizard
  let apiKey = store.resolveApiKey();
  const config0 = store.load();
  if (!apiKey || !config0.chatId) {
    await runSetupWizard(store, configDir);
    apiKey = store.resolveApiKey();
    if (!apiKey) {
      process.exit(1);
    }
  }

  const config = store.load();
  const cwd = process.cwd();
  const permissionMode = (argv["permission-mode"] as PermissionMode) ?? config.permissionMode;
  const dbPath = join(homedir(), "Library", "Messages", "chat.db");

  // Daemon mode
  if (argv.daemon) {
    const { startDaemon, stopDaemon, daemonStatus } = await import("../src/entrypoints/daemon.js");
    switch (argv.daemon) {
      case "start":
        await startDaemon();
        break;
      case "stop":
        stopDaemon();
        break;
      case "status":
        daemonStatus();
        break;
    }
    return;
  }

  // Positional message — first non-option arg
  const positionalMessage = (argv._ as string[]).join(" ").trim() || undefined;

  // One-shot mode
  if (positionalMessage || argv.p) {
    const message = positionalMessage ?? "";
    if (!message) {
      console.error("Error: Provide a message to send in one-shot mode.");
      process.exit(1);
    }
    try {
      const client = new PokeApiClient(apiKey);
      await client.sendMessage(message);
      if (argv["output-format"] === "json") {
        console.log(JSON.stringify({ status: "sent", message }));
      } else {
        console.log("Message sent to Poke.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }
    return;
  }

  // Interactive TUI mode — requires a real TTY
  if (!process.stdin.isTTY) {
    console.error('Error: Interactive mode requires a terminal. Use `poke-code "message"` for non-interactive mode.');
    process.exit(1);
  }

  renderApp({
    apiKey,
    configDir,
    cwd,
    chatId: config.chatId,
    handleId: config.handleId,
    dbPath,
    permissionMode,
    verbose: argv.verbose,
    noTools: argv["no-tools"],
    systemPrompt: argv["system-prompt"],
    resumeSessionId: argv.resume,
  });
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Fatal error: ${msg}`);
  process.exit(1);
});
