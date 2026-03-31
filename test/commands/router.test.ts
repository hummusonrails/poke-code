import { describe, expect, it, vi } from "vitest";
import type { CommandContext } from "../../src/commands/router.js";
import { getCommandList, routeCommand } from "../../src/commands/router.js";

function makeCtx(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    clearScreen: vi.fn(),
    getHistory: vi.fn(() => []),
    listSessions: vi.fn(() => "session-1\nsession-2"),
    resumeSession: vi.fn(),
    getPermissionMode: vi.fn(() => "default"),
    setPermissionMode: vi.fn(),
    getStatus: vi.fn(() => "connected"),
    getConfig: vi.fn(() => "model: claude-3"),
    compact: vi.fn(async () => {}),
    setApiKey: vi.fn(),
    toggleVerbose: vi.fn(() => true),
    getVerbose: vi.fn(() => false),
    quit: vi.fn(),
    getMemoryList: vi.fn(() => "No memory files."),
    getMemoryContent: vi.fn(() => ""),
    runDiagnostics: vi.fn(async () => "All OK"),
    copyLastMessage: vi.fn(() => "Copied last response to clipboard."),
    getReducedMotion: vi.fn(() => false),
    setReducedMotion: vi.fn(),
    cronAdd: vi.fn(async () => "Task created: abc123"),
    cronList: vi.fn(() => "No scheduled tasks."),
    cronRemove: vi.fn(() => "Removed task abc123."),
    cronResults: vi.fn(() => "No results yet."),
    cronInstall: vi.fn(() => "Installed."),
    cronUninstall: vi.fn(() => "Uninstalled."),
    runDream: vi.fn(async () => "Consolidation complete."),
    ...overrides,
  };
}

describe("routeCommand", () => {
  it("returns handled=false for non-slash input", async () => {
    const result = await routeCommand("hello world", makeCtx());
    expect(result.handled).toBe(false);
    expect(result.output).toBe("");
  });

  it("/help lists available commands", async () => {
    const result = await routeCommand("/help", makeCtx());
    expect(result.handled).toBe(true);
    expect(result.output).toContain("Available commands:");
    expect(result.output).toContain("/help");
    expect(result.output).toContain("/quit");
  });

  it("/clear calls clearScreen", async () => {
    const ctx = makeCtx();
    const result = await routeCommand("/clear", ctx);
    expect(result.handled).toBe(true);
    expect(ctx.clearScreen).toHaveBeenCalledOnce();
  });

  it("/history returns history entries", async () => {
    const ctx = makeCtx({ getHistory: vi.fn(() => ["user: hello", "assistant: hi"]) });
    const result = await routeCommand("/history", ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain("user: hello");
    expect(result.output).toContain("assistant: hi");
  });

  it("/history with no entries returns empty message", async () => {
    const ctx = makeCtx({ getHistory: vi.fn(() => []) });
    const result = await routeCommand("/history", ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toBe("No conversation history yet.");
  });

  it("/permissions with valid arg sets mode", async () => {
    const ctx = makeCtx();
    const result = await routeCommand("/permissions trusted", ctx);
    expect(result.handled).toBe(true);
    expect(ctx.setPermissionMode).toHaveBeenCalledWith("trusted");
    expect(result.output).toContain("trusted");
  });

  it("/permissions without arg shows current mode", async () => {
    const ctx = makeCtx({ getPermissionMode: vi.fn(() => "readonly") });
    const result = await routeCommand("/permissions", ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain("readonly");
    expect(ctx.setPermissionMode).not.toHaveBeenCalled();
  });

  it("/quit calls quit", async () => {
    const ctx = makeCtx();
    const result = await routeCommand("/quit", ctx);
    expect(result.handled).toBe(true);
    expect(ctx.quit).toHaveBeenCalledOnce();
  });

  it("/copy calls copyLastMessage and returns its result", async () => {
    const ctx = makeCtx({ copyLastMessage: vi.fn(() => "Copied last response to clipboard.") });
    const result = await routeCommand("/copy", ctx);
    expect(result.handled).toBe(true);
    expect(ctx.copyLastMessage).toHaveBeenCalledOnce();
    expect(result.output).toBe("Copied last response to clipboard.");
  });

  it("unknown command returns helpful message", async () => {
    const result = await routeCommand("/nonexistent", makeCtx());
    expect(result.handled).toBe(true);
    expect(result.output).toContain("Unknown command: /nonexistent");
    expect(result.output).toContain("/help");
  });
});

describe("getCommandList", () => {
  it("returns all registered commands", () => {
    const list = getCommandList();
    const names = list.map((c) => c.name);
    expect(names).toContain("cron");
    expect(names).toContain("dream");
    expect(names).toContain("help");
    expect(names).toContain("quit");
  });

  it("each command has a name and description", () => {
    const list = getCommandList();
    for (const cmd of list) {
      expect(cmd.name).toBeTruthy();
      expect(cmd.description).toBeTruthy();
    }
  });
});

describe("cron commands", () => {
  it("/cron list returns task list", async () => {
    const ctx = makeCtx({ cronList: vi.fn(() => "No scheduled tasks.") });
    const result = await routeCommand("/cron list", ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain("No scheduled tasks");
  });

  it("/cron remove calls cronRemove", async () => {
    const ctx = makeCtx({ cronRemove: vi.fn(() => "Removed task abc123.") });
    const result = await routeCommand("/cron remove abc123", ctx);
    expect(result.handled).toBe(true);
    expect(ctx.cronRemove).toHaveBeenCalledWith("abc123");
  });

  it("/cron with no subcommand shows help", async () => {
    const ctx = makeCtx();
    const result = await routeCommand("/cron", ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain("Usage:");
  });

  it("/dream triggers consolidation", async () => {
    const ctx = makeCtx({ runDream: vi.fn(async () => "Consolidation complete. Wrote 2 memory files.") });
    const result = await routeCommand("/dream", ctx);
    expect(result.handled).toBe(true);
    expect(result.output).toContain("Consolidation");
  });
});
