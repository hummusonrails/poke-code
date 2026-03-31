import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBrackets } from "../../src/parser/bracket-parser.js";

const CWD = "/home/user/project";
const r = (p: string) => path.resolve(CWD, p);

describe("parseBrackets", () => {
  // ── read ──────────────────────────────────────────────────────────────

  describe("[read]", () => {
    it("parses a simple file read", () => {
      const result = parseBrackets("[read] package.json", CWD);
      expect(result).toEqual([{ tool: "read_file", params: { path: r("package.json") } }]);
    });

    it("parses a nested path", () => {
      const result = parseBrackets("[read] src/api/client.ts", CWD);
      expect(result).toEqual([{ tool: "read_file", params: { path: r("src/api/client.ts") } }]);
    });

    it("parses a read with line range", () => {
      const result = parseBrackets("[read] src/app.tsx:10-25", CWD);
      expect(result).toEqual([{ tool: "read_file", params: { path: r("src/app.tsx"), offset: 10, limit: 16 } }]);
    });

    it("handles multiple reads", () => {
      const text = "[read] package.json\nSome text here\n[read] tsconfig.json";
      const result = parseBrackets(text, CWD);
      expect(result).toHaveLength(2);
      expect(result[0].tool).toBe("read_file");
      expect(result[1].tool).toBe("read_file");
    });
  });

  // ── run ───────────────────────────────────────────────────────────────

  describe("[run]", () => {
    it("parses a simple command", () => {
      const result = parseBrackets("[run] npm test", CWD);
      expect(result).toEqual([{ tool: "bash", params: { command: "npm test" } }]);
    });

    it("parses a command with flags", () => {
      const result = parseBrackets("[run] ls -la src/", CWD);
      expect(result).toEqual([{ tool: "bash", params: { command: "ls -la src/" } }]);
    });

    it("parses a piped command", () => {
      const result = parseBrackets("[run] cat package.json | grep scripts", CWD);
      expect(result).toEqual([{ tool: "bash", params: { command: "cat package.json | grep scripts" } }]);
    });
  });

  // ── list ──────────────────────────────────────────────────────────────

  describe("[list]", () => {
    it("parses a directory listing", () => {
      const result = parseBrackets("[list] src/", CWD);
      expect(result).toEqual([{ tool: "list_dir", params: { path: r("src/") } }]);
    });

    it("parses current directory", () => {
      const result = parseBrackets("[list] .", CWD);
      expect(result).toEqual([{ tool: "list_dir", params: { path: r(".") } }]);
    });
  });

  // ── find ──────────────────────────────────────────────────────────────

  describe("[find]", () => {
    it("parses a glob pattern", () => {
      const result = parseBrackets("[find] **/*.test.ts", CWD);
      expect(result).toEqual([{ tool: "glob", params: { pattern: "**/*.test.ts", path: CWD } }]);
    });

    it("parses a specific extension glob", () => {
      const result = parseBrackets("[find] src/**/*.tsx", CWD);
      expect(result).toEqual([{ tool: "glob", params: { pattern: "src/**/*.tsx", path: CWD } }]);
    });
  });

  // ── grep / search ────────────────────────────────────────────────────

  describe("[grep] and [search]", () => {
    it("parses a simple grep", () => {
      const result = parseBrackets("[grep] useState", CWD);
      expect(result).toEqual([{ tool: "grep", params: { pattern: "useState", path: CWD } }]);
    });

    it("parses grep with file filter", () => {
      const result = parseBrackets("[grep] handleSend *.tsx", CWD);
      expect(result).toEqual([{ tool: "grep", params: { pattern: "handleSend", glob: "*.tsx", path: CWD } }]);
    });

    it("treats [search] as web_search", () => {
      const result = parseBrackets("[search] parseResponse", CWD);
      expect(result).toEqual([{ tool: "web_search", params: { query: "parseResponse" } }]);
    });
  });

  // ── write ─────────────────────────────────────────────────────────────

  describe("[write]", () => {
    it("parses a write with [/write] closing tag", () => {
      const text = `[write] src/hello.ts
export const hello = "world";
[/write]`;
      const result = parseBrackets(text, CWD);
      expect(result).toEqual([
        {
          tool: "write_file",
          params: {
            path: r("src/hello.ts"),
            content: 'export const hello = "world";\n',
          },
        },
      ]);
    });

    it("handles nested code fences in write content", () => {
      const text = `[write] README.md
# My Project

Install:

\`\`\`bash
npm install
\`\`\`

Usage:

\`\`\`typescript
import { thing } from './thing';
\`\`\`
[/write]`;
      const result = parseBrackets(text, CWD);
      expect(result).toHaveLength(1);
      expect(result[0].tool).toBe("write_file");
      expect(result[0].params.content).toContain("```bash");
      expect(result[0].params.content).toContain("npm install");
      expect(result[0].params.content).toContain("```typescript");
    });

    it("ignores [write] without closing tag", () => {
      const result = parseBrackets("[write] src/hello.ts", CWD);
      expect(result).toEqual([]);
    });
  });

  // ── edit ──────────────────────────────────────────────────────────────

  describe("[edit]", () => {
    it("parses an edit with old/new blocks", () => {
      const text = `[edit] src/app.ts
[old]
const x = 1;
[/old]
[new]
const x = 2;
[/new]`;
      const result = parseBrackets(text, CWD);
      expect(result).toEqual([
        {
          tool: "edit_file",
          params: {
            path: r("src/app.ts"),
            old_string: "const x = 1;",
            new_string: "const x = 2;",
          },
        },
      ]);
    });

    it("handles multi-line old/new blocks", () => {
      const text = `[edit] src/config.ts
[old]
const a = 1;
const b = 2;
[/old]
[new]
const a = 10;
const b = 20;
[/new]`;
      const result = parseBrackets(text, CWD);
      expect(result).toHaveLength(1);
      expect(result[0].params.old_string).toBe("const a = 1;\nconst b = 2;");
      expect(result[0].params.new_string).toBe("const a = 10;\nconst b = 20;");
    });

    it("ignores [edit] without old/new blocks", () => {
      const result = parseBrackets("[edit] src/app.ts", CWD);
      expect(result).toEqual([]);
    });
  });

  // ── mixed / integration ───────────────────────────────────────────────

  describe("mixed commands", () => {
    it("parses multiple different commands in one response", () => {
      const text = `Let me check a few things.

[read] package.json
[list] src/
[grep] PokeApiClient *.ts`;

      const result = parseBrackets(text, CWD);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ tool: "read_file", params: { path: r("package.json") } });
      expect(result[1]).toEqual({ tool: "list_dir", params: { path: r("src/") } });
      expect(result[2]).toEqual({
        tool: "grep",
        params: { pattern: "PokeApiClient", glob: "*.ts", path: CWD },
      });
    });

    it("parses commands mixed with natural language", () => {
      const text = `I'll start by reading the config:

[read] tsconfig.json

Then check the test structure:

[list] test/`;

      const result = parseBrackets(text, CWD);
      expect(result).toHaveLength(2);
      expect(result[0].tool).toBe("read_file");
      expect(result[1].tool).toBe("list_dir");
    });
  });

  // ── edge cases ────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("returns empty for text with no bracket commands", () => {
      expect(parseBrackets("just some regular text", CWD)).toEqual([]);
    });

    it("returns empty for empty string", () => {
      expect(parseBrackets("", CWD)).toEqual([]);
    });

    it("ignores unknown bracket tags", () => {
      expect(parseBrackets("[dance] around", CWD)).toEqual([]);
    });

    it("is case-insensitive on tags", () => {
      const result = parseBrackets("[READ] package.json", CWD);
      expect(result).toHaveLength(1);
      expect(result[0].tool).toBe("read_file");
    });

    it("handles [read] with extra whitespace", () => {
      const result = parseBrackets("[read]   package.json  ", CWD);
      expect(result).toHaveLength(1);
      expect(result[0].params.path).toBe(r("package.json"));
    });

    it("does not match bracket tags mid-line", () => {
      const result = parseBrackets("I will [read] package.json", CWD);
      expect(result).toEqual([]);
    });

    it("[list] with no path defaults to cwd", () => {
      const result = parseBrackets("[list]", CWD);
      expect(result).toEqual([{ tool: "list_dir", params: { path: CWD } }]);
    });

    it("[read] with no path is ignored", () => {
      expect(parseBrackets("[read]", CWD)).toEqual([]);
    });

    it("[run] with no command is ignored", () => {
      expect(parseBrackets("[run]", CWD)).toEqual([]);
    });

    it("[grep] with no pattern is ignored", () => {
      expect(parseBrackets("[grep]", CWD)).toEqual([]);
    });
  });
});
