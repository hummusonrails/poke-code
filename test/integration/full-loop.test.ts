import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ContextBuilder } from "../../src/context/builder.js";
import { parseResponse } from "../../src/parser/response-parser.js";
import { SessionManager } from "../../src/session/manager.js";
import { ToolExecutor } from "../../src/tools/executor.js";
import { ToolRegistry } from "../../src/tools/registry.js";

const TEST_DIR = join(import.meta.dirname, "__fixtures__/integration");

describe("Full message loop", () => {
  it("assembles context, parses response, executes tools, formats results", async () => {
    mkdirSync(TEST_DIR, { recursive: true });

    // 1. Build context
    const registry = new ToolRegistry();
    const builder = new ContextBuilder(registry, TEST_DIR, TEST_DIR);
    const fullMessage = builder.build("list files in this directory");
    expect(fullMessage).toContain("poke-code");
    expect(fullMessage).toContain("list files in this directory");
    expect(fullMessage).toContain("Working directory");

    // 2. Simulate Poke response with tool call
    const pokeResponse = `I'll list the files for you.\n\n<tool_call>{"tool":"list_dir","params":{"path":"${TEST_DIR}"}}</tool_call>`;
    const parsed = parseResponse(pokeResponse);
    expect(parsed.textSegments).toEqual(["I'll list the files for you."]);
    expect(parsed.toolCalls).toHaveLength(1);
    expect(parsed.toolCalls[0].tool).toBe("list_dir");

    // 3. Execute tools
    const executor = new ToolExecutor(registry, "default");
    const results = await executor.execute(parsed.toolCalls);
    expect(results).toHaveLength(1);
    expect(results[0].error).toBeUndefined();

    // 4. Format results
    const formatted = executor.formatResults(results);
    expect(formatted).toContain("[list_dir]");
    expect(formatted).toContain("<result>");

    // 5. Session recording
    const sessionDir = join(TEST_DIR, "sessions");
    const sessionMgr = new SessionManager(sessionDir);
    const session = sessionMgr.create(TEST_DIR);
    sessionMgr.append(session.id, { role: "user", content: "list files", timestamp: new Date().toISOString() });
    sessionMgr.append(session.id, {
      role: "assistant",
      content: parsed.textSegments.join("\n"),
      toolCalls: parsed.toolCalls,
      timestamp: new Date().toISOString(),
    });
    sessionMgr.append(session.id, { role: "tool", results, timestamp: new Date().toISOString() });

    const entries = sessionMgr.loadEntries(session.id);
    expect(entries).toHaveLength(3);
    expect(entries[0].role).toBe("user");
    expect(entries[1].role).toBe("assistant");
    expect(entries[2].role).toBe("tool");

    rmSync(TEST_DIR, { recursive: true, force: true });
  });
});
