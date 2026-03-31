import { describe, expect, it, vi } from "vitest";
import type { PokeApiClient } from "../../src/api/client.js";
import { conversationLoop } from "../../src/api/conversation.js";
import type { ContextBuilder } from "../../src/context/builder.js";
import type { ToolExecutor } from "../../src/tools/executor.js";
import type { ConversationEvent, ToolResult } from "../../src/types.js";

function mockApiClient() {
  return {
    sendMessage: vi.fn(async () => ({ success: true, message: "ok" })),
  } as unknown as PokeApiClient;
}

function mockExecutor(results: ToolResult[] = []) {
  return {
    execute: vi.fn(async () => results),
    formatResults: vi.fn((r: ToolResult[]) =>
      r.map((res) => `[${res.tool}] ${res.params.path ?? ""}\n<result>\n${res.output}\n</result>`).join("\n\n"),
    ),
  } as unknown as ToolExecutor;
}

function mockContextBuilder() {
  return {
    build: vi.fn((msg: string) => `[context] ${msg}`),
  } as unknown as ContextBuilder;
}

describe("conversationLoop", () => {
  it("yields text events and done for a simple response (no tool calls)", async () => {
    const api = mockApiClient();
    const ctx = mockContextBuilder();
    const executor = mockExecutor();

    const events: ConversationEvent[] = [];
    const gen = conversationLoop("hello", {
      apiClient: api,
      executor,
      contextBuilder: ctx,
      cwd: "/tmp/test-project",
      pollFn: async (onChunk) => {
        onChunk("Hi there!");
        return "Hi there!";
      },
    });

    for await (const event of gen) {
      events.push(event);
    }

    expect(api.sendMessage).toHaveBeenCalledWith("[context] hello");
    expect(events).toContainEqual({ type: "text", content: "Hi there!" });
    expect(events[events.length - 1]).toEqual({ type: "done" });
  });

  it("executes tool calls and loops back", async () => {
    const api = mockApiClient();
    const ctx = mockContextBuilder();
    const toolResult: ToolResult = { tool: "read_file", params: { path: "/tmp/x" }, output: "file content" };
    const executor = mockExecutor([toolResult]);

    let pollCount = 0;
    const gen = conversationLoop("read /tmp/x", {
      apiClient: api,
      executor,
      contextBuilder: ctx,
      cwd: "/tmp/test-project",
      pollFn: async (onChunk) => {
        pollCount++;
        if (pollCount === 1) {
          const resp = 'Let me read that.\n<tool_call>{"tool":"read_file","params":{"path":"/tmp/x"}}</tool_call>';
          onChunk(resp);
          return resp;
        }
        onChunk("Here is the file content.");
        return "Here is the file content.";
      },
    });

    const events: ConversationEvent[] = [];
    for await (const event of gen) {
      events.push(event);
    }

    expect(events.some((e) => e.type === "tool_use")).toBe(true);
    expect(events.some((e) => e.type === "tool_result")).toBe(true);
    expect(events[events.length - 1]).toEqual({ type: "done" });
    expect(api.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("respects maxToolLoops safety valve", async () => {
    const api = mockApiClient();
    const ctx = mockContextBuilder();
    const toolResult: ToolResult = { tool: "bash", params: { command: "echo hi" }, output: "hi" };
    const executor = mockExecutor([toolResult]);

    const gen = conversationLoop("loop forever", {
      apiClient: api,
      executor,
      contextBuilder: ctx,
      cwd: "/tmp/test-project",
      maxToolLoops: 2,
      pollFn: async (onChunk) => {
        const resp = '<tool_call>{"tool":"bash","params":{"command":"echo hi"}}</tool_call>';
        onChunk(resp);
        return resp;
      },
    });

    const events: ConversationEvent[] = [];
    for await (const event of gen) {
      events.push(event);
    }

    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    if (errorEvent?.type === "error") {
      expect(errorEvent.message).toContain("Too many tool loops");
    }
  });

  it("yields error on API failure", async () => {
    const api = {
      sendMessage: vi.fn(async () => {
        throw new Error("Network down");
      }),
    } as unknown as PokeApiClient;
    const ctx = mockContextBuilder();
    const executor = mockExecutor();

    const events: ConversationEvent[] = [];
    const gen = conversationLoop("hello", {
      apiClient: api,
      executor,
      contextBuilder: ctx,
      cwd: "/tmp/test-project",
      pollFn: async () => "",
    });

    for await (const event of gen) {
      events.push(event);
    }

    expect(events.some((e) => e.type === "error" && e.message === "Network down")).toBe(true);
  });

  it("yields error on poll failure", async () => {
    const api = mockApiClient();
    const ctx = mockContextBuilder();
    const executor = mockExecutor();

    const events: ConversationEvent[] = [];
    const gen = conversationLoop("hello", {
      apiClient: api,
      executor,
      contextBuilder: ctx,
      cwd: "/tmp/test-project",
      pollFn: async () => {
        throw new Error("Poll failed");
      },
    });

    for await (const event of gen) {
      events.push(event);
    }

    expect(events.some((e) => e.type === "error" && e.message === "Poll failed")).toBe(true);
  });

  it("skips tool execution when noTools is true", async () => {
    const api = mockApiClient();
    const ctx = mockContextBuilder();
    const executor = mockExecutor();

    const gen = conversationLoop("do stuff", {
      apiClient: api,
      executor,
      contextBuilder: ctx,
      cwd: "/tmp/test-project",
      noTools: true,
      pollFn: async (onChunk) => {
        const resp = 'text <tool_call>{"tool":"bash","params":{"command":"rm -rf /"}}</tool_call>';
        onChunk(resp);
        return resp;
      },
    });

    const events: ConversationEvent[] = [];
    for await (const event of gen) {
      events.push(event);
    }

    expect(events.some((e) => e.type === "tool_use")).toBe(false);
    expect(executor.execute).not.toHaveBeenCalled();
    expect(events[events.length - 1]).toEqual({ type: "done" });
  });
});
