import { describe, expect, it } from "vitest";
import type { ConversationEvent, SessionEntry, ToolCall, ToolEvent } from "../src/types.js";
import { DEFAULT_CONFIG } from "../src/types.js";

describe("types", () => {
  it("DEFAULT_CONFIG has correct defaults", () => {
    expect(DEFAULT_CONFIG.permissionMode).toBe("default");
    expect(DEFAULT_CONFIG.vimMode).toBe(false);
    expect(DEFAULT_CONFIG.theme).toBe("default");
    expect(DEFAULT_CONFIG.pollIntervalNormal).toBe(3000);
    expect(DEFAULT_CONFIG.pollIntervalFast).toBe(1500);
    expect(DEFAULT_CONFIG.fastPollDuration).toBe(30000);
  });

  it("ToolCall shape is valid", () => {
    const call: ToolCall = { tool: "read_file", params: { path: "test.ts" } };
    expect(call.tool).toBe("read_file");
    expect(call.params.path).toBe("test.ts");
  });

  it("SessionEntry supports all roles", () => {
    const user: SessionEntry = { role: "user", content: "hello", timestamp: "2026-01-01T00:00:00Z" };
    const assistant: SessionEntry = {
      role: "assistant",
      content: "hi",
      toolCalls: [],
      timestamp: "2026-01-01T00:00:01Z",
    };
    const tool: SessionEntry = {
      role: "tool",
      results: [{ tool: "bash", params: { command: "ls" }, output: "file.txt" }],
      timestamp: "2026-01-01T00:00:02Z",
    };
    expect(user.role).toBe("user");
    expect(assistant.role).toBe("assistant");
    expect(tool.role).toBe("tool");
  });
});

describe("ConversationEvent type", () => {
  it("accepts text events", () => {
    const event: ConversationEvent = { type: "text", content: "hello" };
    expect(event.type).toBe("text");
  });

  it("accepts tool_use events", () => {
    const event: ConversationEvent = { type: "tool_use", toolCall: { tool: "read_file", params: { path: "/tmp/x" } } };
    expect(event.type).toBe("tool_use");
  });

  it("accepts tool_result events", () => {
    const event: ConversationEvent = {
      type: "tool_result",
      result: { tool: "read_file", params: { path: "/tmp/x" }, output: "content" },
    };
    expect(event.type).toBe("tool_result");
  });

  it("accepts error events", () => {
    const event: ConversationEvent = { type: "error", message: "something broke" };
    expect(event.type).toBe("error");
  });

  it("accepts done events", () => {
    const event: ConversationEvent = { type: "done" };
    expect(event.type).toBe("done");
  });
});

describe("ToolEvent type", () => {
  it("accepts progress events", () => {
    const event: ToolEvent = { type: "progress", tool: "bash", message: "running..." };
    expect(event.type).toBe("progress");
  });

  it("accepts result events", () => {
    const event: ToolEvent = {
      type: "result",
      result: { tool: "bash", params: { command: "ls" }, output: "file.txt" },
    };
    expect(event.type).toBe("result");
  });
});
