import { PermissionError, ToolError } from "../errors.js";
import type { PermissionMode, ToolCall, ToolEvent, ToolResult } from "../types.js";
import { bashTool } from "./bash.js";
import { editFileTool } from "./edit-file.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";
import { listDirTool } from "./list-dir.js";
import { readFileTool } from "./read-file.js";
import type { ToolRegistry } from "./registry.js";
import { webFetchTool } from "./web-fetch.js";
import { webSearchTool } from "./web-search.js";
import { writeFileTool } from "./write-file.js";

type PermissionPromptFn = (toolCall: ToolCall) => Promise<boolean>;

const toolFunctions: Record<string, (params: Record<string, unknown>) => Promise<string>> = {
  read_file: (p) => readFileTool(p as { path: string; limit?: number; offset?: number }),
  write_file: (p) => writeFileTool(p as { path: string; content: string }),
  edit_file: (p) => editFileTool(p as { path: string; old_string: string; new_string: string; replace_all?: boolean }),
  bash: (p) => bashTool(p as { command: string; timeout?: number }),
  glob: (p) => globTool(p as { pattern: string; path?: string }),
  grep: (p) => grepTool(p as { pattern: string; glob?: string; path?: string }),
  list_dir: (p) => listDirTool(p as { path: string }),
  web_search: (p) => webSearchTool(p as { query: string; limit?: number }),
  web_fetch: (p) => webFetchTool(p as { url: string; maxLength?: number }),
};

export async function* executeTool(
  call: ToolCall,
  registry: ToolRegistry,
  mode: PermissionMode,
  promptFn: PermissionPromptFn,
): AsyncGenerator<ToolEvent> {
  const fn = toolFunctions[call.tool];
  if (!fn) {
    const toolErr = new ToolError(`Unknown tool: ${call.tool}`, call.tool, call.params);
    yield {
      type: "result",
      result: { tool: call.tool, params: call.params, output: "", error: toolErr.message },
    };
    return;
  }

  const permission = registry.getPermission(call.tool, mode);
  if (permission === "deny") {
    const permErr = new PermissionError(`Tool ${call.tool} is denied in ${mode} mode`, call.tool, mode);
    yield {
      type: "result",
      result: {
        tool: call.tool,
        params: call.params,
        output: "",
        error: permErr.message,
      },
    };
    return;
  }

  if (permission === "ask") {
    const approved = await promptFn(call);
    if (!approved) {
      yield {
        type: "result",
        result: { tool: call.tool, params: call.params, output: "", error: `Tool ${call.tool} was denied by user` },
      };
      return;
    }
  }

  yield { type: "progress", tool: call.tool, message: `Executing ${call.tool}...` };

  try {
    const output = await fn(call.params);
    yield { type: "result", result: { tool: call.tool, params: call.params, output } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const toolErr = new ToolError(message, call.tool, call.params);
    yield { type: "result", result: { tool: call.tool, params: call.params, output: "", error: toolErr.message } };
  }
}

export class ToolExecutor {
  private registry: ToolRegistry;
  private mode: PermissionMode;
  private promptFn: PermissionPromptFn;

  constructor(registry: ToolRegistry, mode: PermissionMode, promptFn?: PermissionPromptFn) {
    this.registry = registry;
    this.mode = mode;
    this.promptFn = promptFn ?? (() => Promise.resolve(false));
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  /**
   * Execute tool calls with concurrency limit.
   * Read-only tools run in parallel (up to 5). Write/bash tools run sequentially.
   */
  async execute(toolCalls: ToolCall[], concurrency = 5): Promise<ToolResult[]> {
    const READ_TOOLS = new Set(["read_file", "list_dir", "glob", "grep", "web_search", "web_fetch"]);

    // Separate read-only (parallelizable) from write (sequential)
    const readCalls: ToolCall[] = [];
    const writeCalls: ToolCall[] = [];
    for (const call of toolCalls) {
      if (READ_TOOLS.has(call.tool)) {
        readCalls.push(call);
      } else {
        writeCalls.push(call);
      }
    }

    const results: ToolResult[] = [];

    // Execute read tools in parallel with concurrency limit
    if (readCalls.length > 0) {
      const readResults = await this.executeParallel(readCalls, concurrency);
      results.push(...readResults);
    }

    // Execute write tools sequentially (order matters, need permission prompts)
    for (const call of writeCalls) {
      for await (const event of executeTool(call, this.registry, this.mode, this.promptFn)) {
        if (event.type === "result") {
          results.push(event.result);
        }
      }
    }

    return results;
  }

  private async executeParallel(calls: ToolCall[], concurrency: number): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    let active = 0;
    let resolveSlot: (() => void) | null = null;

    const waitForSlot = (): Promise<void> => {
      if (active < concurrency) return Promise.resolve();
      return new Promise((resolve) => {
        resolveSlot = resolve;
      });
    };

    const tasks = calls.map(async (call) => {
      await waitForSlot();
      active++;
      try {
        for await (const event of executeTool(call, this.registry, this.mode, this.promptFn)) {
          if (event.type === "result") {
            results.push(event.result);
          }
        }
      } finally {
        active--;
        if (resolveSlot) {
          const r = resolveSlot;
          resolveSlot = null;
          r();
        }
      }
    });

    await Promise.all(tasks);
    return results;
  }

  formatResults(results: ToolResult[], maxPerResult = 8000): string {
    const sections = results.map((r) => {
      const label = r.params.path ?? r.params.command ?? r.params.pattern ?? "";
      const header = `[${r.tool}] ${label}`;
      let body = r.error ? `Error: ${r.error}` : r.output;
      if (body.length > maxPerResult) {
        body = `${body.slice(0, maxPerResult)}\n... (truncated)`;
      }
      return `${header}\n<result>\n${body}\n</result>`;
    });
    return `Tool results:\n\n${sections.join("\n\n")}`;
  }
}
