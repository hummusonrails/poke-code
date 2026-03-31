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
    quit: vi.fn(),
    copyLastMessage: vi.fn(() => "Copied last response to clipboard."),
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
  it("returns all 17 registered commands", () => {
    const list = getCommandList();
    expect(list).toHaveLength(17);
    const names = list.map((c) => c.name);
    expect(names).toContain("help");
    expect(names).toContain("clear");
    expect(names).toContain("history");
    expect(names).toContain("sessions");
    expect(names).toContain("compact");
    expect(names).toContain("permissions");
    expect(names).toContain("status");
    expect(names).toContain("model");
    expect(names).toContain("init");
    expect(names).toContain("apikey");
    expect(names).toContain("verbose");
    expect(names).toContain("quit");
    expect(names).toContain("memory");
    expect(names).toContain("doctor");
    expect(names).toContain("bug");
    expect(names).toContain("copy");
    expect(names).toContain("reduce-motion");
  });

  it("each command has a name and description", () => {
    const list = getCommandList();
    for (const cmd of list) {
      expect(cmd.name).toBeTruthy();
      expect(cmd.description).toBeTruthy();
    }
  });
});
