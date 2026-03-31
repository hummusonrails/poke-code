import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseIntent } from "../../src/parser/intent-parser.js";

const cwd = "/home/user/project";
const r = (p: string) => path.resolve(cwd, p);

describe("parseIntent", () => {
  // ── read_file ────────────────────────────────────────────────────────────

  describe("read_file intents", () => {
    it('reads a bare well-known filename after "read"', () => {
      expect(parseIntent("let me read the package.json", cwd)).toEqual([
        { tool: "read_file", params: { path: r("package.json") } },
      ]);
    });

    it('reads a backtick-wrapped path after "look at"', () => {
      expect(parseIntent("I'll look at `src/app.tsx`", cwd)).toEqual([
        { tool: "read_file", params: { path: r("src/app.tsx") } },
      ]);
    });

    it('reads a double-quoted filename after "check"', () => {
      expect(parseIntent('let me check "tsconfig.json" for you', cwd)).toEqual([
        { tool: "read_file", params: { path: r("tsconfig.json") } },
      ]);
    });

    it('reads a single-quoted filename after "open"', () => {
      expect(parseIntent("open 'README.md' please", cwd)).toEqual([
        { tool: "read_file", params: { path: r("README.md") } },
      ]);
    });

    it('reads a path-like token with extension after "see"', () => {
      expect(parseIntent("let me see src/index.ts", cwd)).toEqual([
        { tool: "read_file", params: { path: r("src/index.ts") } },
      ]);
    });

    it('reads a file after "view"', () => {
      expect(parseIntent("view Makefile", cwd)).toEqual([{ tool: "read_file", params: { path: r("Makefile") } }]);
    });

    it('reads a file after "examine"', () => {
      expect(parseIntent("examine `lib/utils.ts`", cwd)).toEqual([
        { tool: "read_file", params: { path: r("lib/utils.ts") } },
      ]);
    });

    it("is case-insensitive for trigger words", () => {
      expect(parseIntent("READ the package.json", cwd)).toEqual([
        { tool: "read_file", params: { path: r("package.json") } },
      ]);
    });
  });

  // ── list_dir ─────────────────────────────────────────────────────────────

  describe("list_dir intents", () => {
    it("lists a directory with trailing slash", () => {
      expect(parseIntent("let me list the src/ directory", cwd)).toEqual([
        { tool: "list_dir", params: { path: r("src") } },
      ]);
    });

    it('lists a bare directory name after "see what\'s in"', () => {
      expect(parseIntent("I'll see what's in the test directory", cwd)).toEqual([
        { tool: "list_dir", params: { path: r("test") } },
      ]);
    });

    it('lists after "check the contents of"', () => {
      expect(parseIntent("check the contents of `src/`", cwd)).toEqual([
        { tool: "list_dir", params: { path: r("src") } },
      ]);
    });

    it('lists after "check the directory"', () => {
      expect(parseIntent("check the directory `dist/`", cwd)).toEqual([
        { tool: "list_dir", params: { path: r("dist") } },
      ]);
    });

    it('lists after "look at the directory"', () => {
      expect(parseIntent("look at the directory `lib/`", cwd)).toEqual([
        { tool: "list_dir", params: { path: r("lib") } },
      ]);
    });

    it("lists an extensionless path-like token as list_dir", () => {
      expect(parseIntent("list `components/`", cwd)).toEqual([{ tool: "list_dir", params: { path: r("components") } }]);
    });

    it("strips trailing slash from resolved path", () => {
      const result = parseIntent("list src/", cwd);
      expect(result).toHaveLength(1);
      expect(result[0].tool).toBe("list_dir");
      // resolved path should not end with /
      expect((result[0].params.path as string).endsWith("/")).toBe(false);
    });
  });

  // ── bash ─────────────────────────────────────────────────────────────────

  describe("bash intents", () => {
    it('runs a backtick-wrapped command after "run"', () => {
      expect(parseIntent("I'll run `npm test` to check", cwd)).toEqual([
        { tool: "bash", params: { command: "npm test" } },
      ]);
    });

    it('runs a double-quoted command after "execute"', () => {
      expect(parseIntent('let me execute "ls -la"', cwd)).toEqual([{ tool: "bash", params: { command: "ls -la" } }]);
    });

    it('runs a command after "try"', () => {
      expect(parseIntent("try `make build`", cwd)).toEqual([{ tool: "bash", params: { command: "make build" } }]);
    });

    it("does not produce bash intent without a trigger word", () => {
      const result = parseIntent("`npm test`", cwd);
      // no bash trigger — should be empty or not bash
      expect(result.every((tc) => tc.tool !== "bash")).toBe(true);
    });
  });

  // ── glob ─────────────────────────────────────────────────────────────────

  describe("glob intents", () => {
    it('finds files with a backtick pattern after "find files"', () => {
      expect(parseIntent("find files matching `**/*.ts`", cwd)).toEqual([
        { tool: "glob", params: { pattern: "**/*.ts" } },
      ]);
    });

    it('finds files after "search for files"', () => {
      expect(parseIntent("search for files `*.json`", cwd)).toEqual([{ tool: "glob", params: { pattern: "*.json" } }]);
    });

    it('finds files after "look for files"', () => {
      expect(parseIntent("look for files matching `src/**/*.tsx`", cwd)).toEqual([
        { tool: "glob", params: { pattern: "src/**/*.tsx" } },
      ]);
    });
  });

  // ── grep ─────────────────────────────────────────────────────────────────

  describe("grep intents", () => {
    it('searches for a backtick pattern after "search for"', () => {
      expect(parseIntent("let me search for `useState` in the codebase", cwd)).toEqual([
        { tool: "grep", params: { pattern: "useState" } },
      ]);
    });

    it('searches after "grep for"', () => {
      expect(parseIntent("grep for `TODO` in source files", cwd)).toEqual([
        { tool: "grep", params: { pattern: "TODO" } },
      ]);
    });

    it('searches after "find in files"', () => {
      expect(parseIntent("find in files `import React`", cwd)).toEqual([
        { tool: "grep", params: { pattern: "import React" } },
      ]);
    });

    it("searches with a quoted pattern", () => {
      expect(parseIntent('grep for "useEffect"', cwd)).toEqual([{ tool: "grep", params: { pattern: "useEffect" } }]);
    });
  });

  // ── multiple intents ─────────────────────────────────────────────────────

  describe("multiple intents in one message", () => {
    it("extracts read_file and list_dir from a single message", () => {
      const result = parseIntent("I'll read package.json and check the src/ directory", cwd);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ tool: "read_file", params: { path: r("package.json") } });
      expect(result[1]).toEqual({ tool: "list_dir", params: { path: r("src") } });
    });

    it("extracts two read_file calls", () => {
      const result = parseIntent("look at `src/app.tsx` and see `src/types.ts`", cwd);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ tool: "read_file", params: { path: r("src/app.tsx") } });
      expect(result[1]).toEqual({ tool: "read_file", params: { path: r("src/types.ts") } });
    });
  });

  // ── no intent (vague) ────────────────────────────────────────────────────

  describe("returns empty array for vague messages", () => {
    it('returns [] for "let me think about this"', () => {
      expect(parseIntent("let me think about this", cwd)).toEqual([]);
    });

    it('returns [] for "sure, I can help with that"', () => {
      expect(parseIntent("sure, I can help with that", cwd)).toEqual([]);
    });

    it("returns [] for trigger word with no target", () => {
      expect(parseIntent("on it, reading it now", cwd)).toEqual([]);
    });

    it("returns [] for empty string", () => {
      expect(parseIntent("", cwd)).toEqual([]);
    });

    it("returns [] for whitespace only", () => {
      expect(parseIntent("   ", cwd)).toEqual([]);
    });
  });

  // ── word boundary checks ─────────────────────────────────────────────────

  describe("word boundary safety", () => {
    it('does not trigger on "already" containing "read"', () => {
      expect(parseIntent("I already checked everything", cwd)).toEqual([]);
    });

    it('does not trigger on "execute" inside another word (none exist here — just confirm boundary)', () => {
      // "executed" should not match "execute" trigger at start of sentence without a target
      expect(parseIntent("I executed the plan", cwd)).toEqual([]);
    });
  });

  // ── write/edit safety ────────────────────────────────────────────────────

  describe("never returns write_file or edit_file", () => {
    it("does not produce write_file even when text describes writing", () => {
      const result = parseIntent("write to package.json", cwd);
      expect(result.every((tc) => tc.tool !== "write_file")).toBe(true);
    });

    it("does not produce edit_file even when text describes editing", () => {
      const result = parseIntent("edit src/app.tsx", cwd);
      expect(result.every((tc) => tc.tool !== "edit_file")).toBe(true);
    });
  });
});
