export interface CommandContext {
  clearScreen: () => void;
  getHistory: () => string[];
  listSessions: () => string;
  resumeSession: (id: string) => void;
  getPermissionMode: () => string;
  setPermissionMode: (mode: string) => void;
  getStatus: () => string;
  getConfig: () => string;
  compact: () => Promise<void>;
  setApiKey: (key: string) => void;
  toggleVerbose: () => boolean;
  getVerbose: () => boolean;
  quit: () => void;
  getMemoryList: () => string;
  getMemoryContent: (name: string) => string;
  runDiagnostics: () => Promise<string>;
  copyLastMessage: () => string;
  getReducedMotion: () => boolean;
  setReducedMotion: (on: boolean) => void;
  cronAdd: (scheduleOrNatural: string, prompt: string) => Promise<string>;
  cronList: () => string;
  cronRemove: (id: string) => string;
  cronResults: (id?: string) => string;
  cronInstall: () => string;
  cronUninstall: () => string;
  runDream: () => Promise<string>;
}

export interface CommandResult {
  output: string;
  handled: boolean;
}

const COMMANDS: Record<
  string,
  { description: string; handler: (ctx: CommandContext, args: string) => CommandResult | Promise<CommandResult> }
> = {};

export function registerCommand(
  name: string,
  description: string,
  handler: (ctx: CommandContext, args: string) => CommandResult | Promise<CommandResult>,
): void {
  COMMANDS[name] = { description, handler };
}

export async function routeCommand(input: string, ctx: CommandContext): Promise<CommandResult> {
  if (!input.startsWith("/")) return { output: "", handled: false };
  const [cmd, ...argParts] = input.slice(1).split(" ");
  const args = argParts.join(" ").trim();
  const command = COMMANDS[cmd];
  if (!command) return { output: `Unknown command: /${cmd}. Type /help for available commands.`, handled: true };
  return command.handler(ctx, args);
}

export function getCommandList(): { name: string; description: string }[] {
  return Object.entries(COMMANDS).map(([name, { description }]) => ({ name, description }));
}

// Register all commands
registerCommand("help", "Show available commands", () => {
  const lines = getCommandList().map((c) => `  /${c.name.padEnd(14)} ${c.description}`);
  return { output: `Available commands:\n${lines.join("\n")}`, handled: true };
});

registerCommand("clear", "Clear the screen", (ctx) => {
  ctx.clearScreen();
  return { output: "", handled: true };
});

registerCommand("history", "Show conversation history", (ctx) => {
  const history = ctx.getHistory();
  return { output: history.length === 0 ? "No conversation history yet." : history.join("\n"), handled: true };
});

registerCommand("sessions", "List and resume sessions", (ctx, args) => {
  if (args) {
    ctx.resumeSession(args);
    return { output: `Resuming session: ${args}`, handled: true };
  }
  return { output: ctx.listSessions(), handled: true };
});

registerCommand("compact", "Summarize and compress context", async (ctx) => {
  await ctx.compact();
  return { output: "Context compacted.", handled: true };
});

registerCommand("permissions", "Switch permission mode", (ctx, args) => {
  if (args && ["default", "trusted", "readonly"].includes(args)) {
    ctx.setPermissionMode(args);
    return { output: `Permission mode set to: ${args}`, handled: true };
  }
  return {
    output: `Current mode: ${ctx.getPermissionMode()}. Usage: /permissions <default|trusted|readonly>`,
    handled: true,
  };
});

registerCommand("status", "Show connection status", (ctx) => ({ output: ctx.getStatus(), handled: true }));
registerCommand("model", "Show current configuration", (ctx) => ({ output: ctx.getConfig(), handled: true }));
registerCommand("init", "Re-run setup wizard", () => ({
  output: "Run `poke --init` to re-run the setup wizard.",
  handled: true,
}));

registerCommand("apikey", "Update your Poke API key", (ctx, args) => {
  if (!args) {
    return {
      output: "Usage: /apikey <your-new-api-key>\nGet keys at https://poke.com/kitchen → API Keys",
      handled: true,
    };
  }
  ctx.setApiKey(args);
  return { output: "API key updated.", handled: true };
});
registerCommand("verbose", "Toggle verbose tool output", (ctx) => {
  const isOn = ctx.toggleVerbose();
  return {
    output: `Verbose mode ${isOn ? "on" : "off"} — tool results will ${isOn ? "show full output" : "show compact summaries"}.`,
    handled: true,
  };
});

registerCommand("memory", "List or view memory files", (ctx, args) => {
  if (args) {
    return { output: ctx.getMemoryContent(args), handled: true };
  }
  return { output: ctx.getMemoryList(), handled: true };
});

registerCommand("doctor", "Run diagnostics on your poke-code setup", async (ctx) => {
  const result = await ctx.runDiagnostics();
  return { output: result, handled: true };
});

registerCommand("bug", "Report a bug or issue", () => ({
  output: "Report issues at: https://github.com/hummusonrails/poke-code/issues",
  handled: true,
}));

registerCommand("copy", "Copy last assistant message to clipboard", (ctx) => {
  const result = ctx.copyLastMessage();
  return { output: result, handled: true };
});

registerCommand('reduce-motion', 'Toggle reduced motion (disable animations)', (ctx) => {
  const current = ctx.getReducedMotion();
  ctx.setReducedMotion(!current);
  return { output: `Reduced motion ${!current ? 'on' : 'off'} — animations ${!current ? 'disabled' : 'enabled'}.`, handled: true };
});

registerCommand("cron", "Manage scheduled prompts", async (ctx, args) => {
  const parts = args.split(/\s+/);
  const sub = parts[0] || "";
  const rest = parts.slice(1).join(" ");

  switch (sub) {
    case "list":
      return { output: ctx.cronList(), handled: true };
    case "remove": {
      if (!rest) return { output: "Usage: /cron remove <id>", handled: true };
      return { output: ctx.cronRemove(rest), handled: true };
    }
    case "results": {
      return { output: ctx.cronResults(rest || undefined), handled: true };
    }
    case "add": {
      const cronParts = rest.split(/\s+/);
      if (cronParts.length < 6) {
        return { output: "Usage: /cron add <min> <hr> <dom> <mon> <dow> <prompt>", handled: true };
      }
      const schedule = cronParts.slice(0, 5).join(" ");
      const prompt = cronParts.slice(5).join(" ");
      const result = await ctx.cronAdd(schedule, prompt);
      return { output: result, handled: true };
    }
    case "once": {
      const cronParts = rest.split(/\s+/);
      if (cronParts.length < 6) {
        return { output: "Usage: /cron once <min> <hr> <dom> <mon> <dow> <prompt>", handled: true };
      }
      const schedule = cronParts.slice(0, 5).join(" ");
      const prompt = cronParts.slice(5).join(" ");
      const result = await ctx.cronAdd(schedule, prompt + " [oneshot]");
      return { output: result, handled: true };
    }
    case "install":
      return { output: ctx.cronInstall(), handled: true };
    case "uninstall":
      return { output: ctx.cronUninstall(), handled: true };
    default: {
      if (args.trim()) {
        const result = await ctx.cronAdd(args, "");
        return { output: result, handled: true };
      }
      return {
        output: `Usage:
  /cron add <cron-expr> <prompt>     — schedule a recurring task
  /cron once <cron-expr> <prompt>    — schedule a one-shot task
  /cron every 30 minutes <prompt>    — natural language scheduling
  /cron list                         — list all tasks
  /cron remove <id>                  — remove a task
  /cron results [id]                 — view execution results
  /cron install                      — install macOS launchd auto-start
  /cron uninstall                    — remove launchd auto-start`,
        handled: true,
      };
    }
  }
});

registerCommand("dream", "Consolidate session memories", async (ctx) => {
  const result = await ctx.runDream();
  return { output: result, handled: true };
});

registerCommand("quit", "Exit the CLI", (ctx) => {
  ctx.quit();
  return { output: "", handled: true };
});
