import type { PermissionMode, ToolDefinition, ToolPermission } from "../types.js";

const READ_TOOLS = new Set(["read_file", "glob", "grep", "list_dir", "web_search", "web_fetch"]);

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "read_file",
    description: "Read a file's contents. Returns the file text.",
    params: {
      path: { type: "string", required: true, description: "Absolute or relative file path" },
      limit: { type: "number", required: false, description: "Max lines to read (default: all)" },
      offset: { type: "number", required: false, description: "Line number to start from (default: 1)" },
    },
    permission: "auto",
  },
  {
    name: "write_file",
    description: "Create or overwrite a file with the given content.",
    params: {
      path: { type: "string", required: true, description: "File path to write" },
      content: { type: "string", required: true, description: "Full file content" },
    },
    permission: "ask",
  },
  {
    name: "edit_file",
    description: "Replace a string in a file. The old_string must be unique in the file unless replace_all is true.",
    params: {
      path: { type: "string", required: true, description: "File path to edit" },
      old_string: { type: "string", required: true, description: "Exact string to find" },
      new_string: { type: "string", required: true, description: "Replacement string" },
      replace_all: { type: "boolean", required: false, description: "Replace all occurrences (default: false)" },
    },
    permission: "ask",
  },
  {
    name: "bash",
    description: "Execute a shell command and return its output.",
    params: {
      command: { type: "string", required: true, description: "Shell command to run" },
      timeout: { type: "number", required: false, description: "Timeout in milliseconds (default: 120000)" },
    },
    permission: "ask",
  },
  {
    name: "glob",
    description: "Find files matching a glob pattern. Returns matching file paths.",
    params: {
      pattern: { type: "string", required: true, description: 'Glob pattern (e.g., "**/*.ts")' },
      path: { type: "string", required: false, description: "Directory to search in (default: cwd)" },
    },
    permission: "auto",
  },
  {
    name: "grep",
    description: "Search file contents for a regex pattern. Returns matching lines.",
    params: {
      pattern: { type: "string", required: true, description: "Regex pattern to search for" },
      glob: { type: "string", required: false, description: 'Glob filter for files (e.g., "*.ts")' },
      path: { type: "string", required: false, description: "Directory to search in (default: cwd)" },
    },
    permission: "auto",
  },
  {
    name: "list_dir",
    description: "List directory contents. Returns file and directory names.",
    params: {
      path: { type: "string", required: true, description: "Directory path to list" },
    },
    permission: "auto",
  },
  {
    name: "web_search",
    description: "Search the web using DuckDuckGo. Returns titles, URLs, and snippets.",
    params: {
      query: { type: "string", required: true, description: "Search query" },
      limit: { type: "number", required: false, description: "Max results (default: 5)" },
    },
    permission: "auto",
  },
  {
    name: "web_fetch",
    description: "Fetch a web page and return its text content.",
    params: {
      url: { type: "string", required: true, description: "URL to fetch (must start with http:// or https://)" },
      maxLength: { type: "number", required: false, description: "Max characters to return (default: 10000)" },
    },
    permission: "auto",
  },
];

export class ToolRegistry {
  private tools: Map<string, ToolDefinition>;

  constructor() {
    this.tools = new Map();
    for (const tool of TOOL_DEFINITIONS) {
      this.tools.set(tool.name, tool);
    }
  }

  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getPermission(toolName: string, mode: PermissionMode): ToolPermission {
    const tool = this.tools.get(toolName);
    if (!tool) return "deny";

    const isReadTool = READ_TOOLS.has(toolName);

    switch (mode) {
      case "trusted":
        return "auto";
      case "readonly":
        return isReadTool ? "auto" : "deny";
      default:
        return isReadTool ? "auto" : "ask";
    }
  }

  generateToolSchema(): string {
    const sections = this.listTools().map((tool) => {
      const paramLines = Object.entries(tool.params)
        .map(
          ([name, info]) =>
            `  - ${name} (${info.type}${info.required ? ", required" : ", optional"}): ${info.description}`,
        )
        .join("\n");

      const exampleParams: Record<string, unknown> = {};
      for (const [name, info] of Object.entries(tool.params)) {
        if (info.required) {
          exampleParams[name] = info.type === "string" ? `example_${name}` : info.type === "number" ? 100 : true;
        }
      }

      return `### ${tool.name}\n${tool.description}\nParams:\n${paramLines}\nExample:\n<tool_call>{"tool":"${tool.name}","params":${JSON.stringify(exampleParams)}}</tool_call>`;
    });

    return sections.join("\n\n");
  }
}
