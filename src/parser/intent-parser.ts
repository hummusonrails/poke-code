import path from "node:path";
import type { ToolCall } from "../types.js";

// ── Constants ──────────────────────────────────────────────────────────────

/** File extensions that unambiguously signal a file (not a directory). */
const FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".py",
  ".yaml",
  ".yml",
  ".toml",
  ".css",
  ".scss",
  ".html",
  ".htm",
  ".txt",
  ".sh",
  ".env",
  ".lock",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
]);

/** Bare filenames recognised without a path separator or extension marker. */
const WELL_KNOWN_FILES = new Set([
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "jsconfig.json",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "Makefile",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  ".gitignore",
  ".npmignore",
  ".eslintrc",
  ".prettierrc",
  "vite.config.ts",
  "vite.config.js",
  "vitest.config.ts",
  "vitest.config.js",
  "next.config.js",
  "next.config.ts",
  "tailwind.config.js",
  "tailwind.config.ts",
  "babel.config.js",
  "jest.config.js",
  "jest.config.ts",
]);

// ── Helpers ────────────────────────────────────────────────────────────────

function isFilePath(token: string): boolean {
  const ext = path.extname(token);
  return ext !== "" && FILE_EXTENSIONS.has(ext);
}

function _isDirPath(token: string): boolean {
  // Explicit trailing slash OR no extension
  return token.endsWith("/") || path.extname(token) === "";
}

/**
 * Strip a trailing slash and resolve relative to cwd.
 * Never resolves an absolute path differently (path.resolve handles that).
 */
function resolvePath(token: string, cwd: string): string {
  const cleaned = token.replace(/\/+$/, "");
  return path.resolve(cwd, cleaned);
}

/**
 * Decide whether a path token represents a file or directory,
 * and return the appropriate tool name.
 */
function toolForPath(token: string): "read_file" | "list_dir" {
  if (token.endsWith("/")) return "list_dir";
  if (isFilePath(token)) return "read_file";
  if (WELL_KNOWN_FILES.has(token)) return "read_file";
  // extensionless token with a path separator is still ambiguous → list_dir
  return "list_dir";
}

// ── Extraction helpers ─────────────────────────────────────────────────────

/**
 * Extract the first backtick-wrapped, double-quoted, or single-quoted token
 * from `text` starting at `offset`.  Returns [value, endIndex] or null.
 */
function _extractQuoted(text: string, offset = 0): [string, number] | null {
  const sub = text.slice(offset);

  // backtick
  const bt = sub.match(/`([^`]+)`/);
  // double-quote
  const dq = sub.match(/"([^"]+)"/);
  // single-quote
  const sq = sub.match(/'([^']+)'/);

  // pick the one that appears earliest
  const candidates: Array<[RegExpMatchArray, string]> = [];
  if (bt) candidates.push([bt, "bt"]);
  if (dq) candidates.push([dq, "dq"]);
  if (sq) candidates.push([sq, "sq"]);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a[0].index! - b[0].index!);
  const [winner] = candidates;
  const match = winner[0];
  return [match[1], offset + match.index! + match[0].length];
}

/**
 * Extract the first path-like or well-known bare token from `text`.
 * A path-like token contains `/` or a recognised file extension,
 * or is a well-known bare filename.
 */
function extractPathToken(text: string): string | null {
  // Split on whitespace and common punctuation, keeping slashes inside tokens
  const tokens = text.split(/[\s,;:!?()[\]{}]+/);
  for (const token of tokens) {
    if (!token) continue;
    // strip surrounding quotes left over from splitting
    const t = token.replace(/^['"`]+|['"`]+$/g, "");
    if (!t) continue;

    if (WELL_KNOWN_FILES.has(t)) return t;
    if (t.includes("/")) return t;
    if (FILE_EXTENSIONS.has(path.extname(t))) return t;
  }
  return null;
}

// ── Segment-level intent scanners ──────────────────────────────────────────

/**
 * Words that are never directory or file names — used when trying to extract
 * a bare word as a directory target after a list_dir trigger.
 */
const NOISE_WORDS = new Set([
  "the",
  "a",
  "an",
  "this",
  "that",
  "it",
  "its",
  "directory",
  "folder",
  "dir",
  "path",
  "file",
  "files",
  "in",
  "of",
  "for",
  "to",
  "at",
  "on",
  "by",
  "up",
  "me",
  "us",
  "you",
  "now",
  "please",
  "just",
  "some",
  "contents",
  "content",
]);

/**
 * For list_dir triggers: after the standard extraction fails, try to find the
 * first bare word that looks like it could be a directory name (skip noise words).
 */
function extractBareDirName(after: string): string | null {
  const tokens = after.split(/[\s,;:!?()[\]{}]+/);
  for (const token of tokens) {
    if (!token) continue;
    const t = token.replace(/^['"`]+|['"`]+$/g, "").replace(/\/+$/, "");
    if (!t) continue;
    if (NOISE_WORDS.has(t.toLowerCase())) continue;
    // Must look like a reasonable directory name: alphanumeric, dashes, underscores, dots
    if (/^[\w.-]+$/.test(t)) return t;
  }
  return null;
}

/**
 * Attempt to find a file/dir path in the text that follows a read/list trigger.
 * Priority: backtick > quoted > path-like > well-known bare name.
 * For list_dir triggers an extra bare-word fallback is available via extractBareDirName.
 */
function extractFilePath(after: string, allowBareDirFallback = false): string | null {
  // 1. Backtick-wrapped
  const bt = after.match(/`([^`]+)`/);
  if (bt) return bt[1];

  // 2. Quoted
  const dq = after.match(/"([^"]+)"/);
  if (dq) return dq[1];
  const sq = after.match(/'([^']+)'/);
  if (sq) return sq[1];

  // 3. Path-like or well-known token in remaining text
  const pathTok = extractPathToken(after);
  if (pathTok) return pathTok;

  // 4. For list_dir triggers: accept a plain directory word
  if (allowBareDirFallback) return extractBareDirName(after);

  return null;
}

/**
 * Extract a command from text after a bash trigger.
 * Only backtick or quoted forms count.
 */
function extractCommand(after: string): string | null {
  const bt = after.match(/`([^`]+)`/);
  if (bt) return bt[1];
  const dq = after.match(/"([^"]+)"/);
  if (dq) return dq[1];
  return null;
}

/**
 * Extract a pattern (grep/glob) from text after the trigger.
 * Backtick or quoted.
 */
function extractPattern(after: string): string | null {
  const bt = after.match(/`([^`]+)`/);
  if (bt) return bt[1];
  const dq = after.match(/"([^"]+)"/);
  if (dq) return dq[1];
  const sq = after.match(/'([^']+)'/);
  if (sq) return sq[1];
  return null;
}

// ── Trigger regexes ────────────────────────────────────────────────────────
//
// Each regex uses word-boundary \b on the left so we don't match
// "already" or "already reading".  The 'i' flag gives case-insensitivity.
//
// We capture the *position after the trigger* so we know where to look
// for the argument.

interface TriggerMatch {
  tool: "read_file" | "list_dir" | "bash" | "glob" | "grep" | "web_search" | "web_fetch";
  afterIndex: number; // index in original string where the argument search starts
}

// Order matters: more-specific multi-word triggers before single-word ones.
const TRIGGERS: Array<{
  pattern: RegExp;
  tool: "read_file" | "list_dir" | "bash" | "glob" | "grep" | "web_search" | "web_fetch";
}> = [
  // web_fetch — before web_search so "fetch" doesn't get caught by bash triggers
  { pattern: /\bfetch\s+the\s+page\s+at\b/gi, tool: "web_fetch" },
  { pattern: /\bfetch\s+the\s+url\b/gi, tool: "web_fetch" },
  { pattern: /\bfetch\s+(?:https?:\/\/)/gi, tool: "web_fetch" },

  // web_search — multi-word first
  { pattern: /\bsearch\s+the\s+web\s+for\b/gi, tool: "web_search" },
  { pattern: /\blook\s+up\s+online\b/gi, tool: "web_search" },
  { pattern: /\bweb\s+search\s+for\b/gi, tool: "web_search" },
  { pattern: /\bsearch\s+online\s+for\b/gi, tool: "web_search" },
  { pattern: /\bsearch\s+the\s+web\b/gi, tool: "web_search" },
  { pattern: /\blook\s+up\b/gi, tool: "web_search" },

  // list_dir — multi-word first
  { pattern: /\bsee\s+what'?s?\s+in\b/gi, tool: "list_dir" },
  { pattern: /\bcheck\s+the\s+contents\s+of\b/gi, tool: "list_dir" },
  { pattern: /\bcheck\s+the\s+directory\b/gi, tool: "list_dir" },
  { pattern: /\blook\s+at\s+the\s+directory\b/gi, tool: "list_dir" },
  { pattern: /\blist\b/gi, tool: "list_dir" },

  // glob
  { pattern: /\bfind\s+files\b/gi, tool: "glob" },
  { pattern: /\bsearch\s+for\s+files\b/gi, tool: "glob" },
  { pattern: /\blook\s+for\s+files\b/gi, tool: "glob" },

  // grep
  { pattern: /\bfind\s+in\s+files\b/gi, tool: "grep" },
  { pattern: /\bgrep\s+for\b/gi, tool: "grep" },
  { pattern: /\bsearch\s+for\b/gi, tool: "grep" },

  // bash
  { pattern: /\bexecute\b/gi, tool: "bash" },
  { pattern: /\brun\b/gi, tool: "bash" },
  { pattern: /\btry\b/gi, tool: "bash" },

  // read_file — single-word triggers (after list_dir multi-word ones)
  { pattern: /\blook\s+at\b/gi, tool: "read_file" },
  { pattern: /\bread\b/gi, tool: "read_file" },
  { pattern: /\bcheck\b/gi, tool: "read_file" },
  { pattern: /\bopen\b/gi, tool: "read_file" },
  { pattern: /\bsee\b/gi, tool: "read_file" },
  { pattern: /\bview\b/gi, tool: "read_file" },
  { pattern: /\bexamine\b/gi, tool: "read_file" },
];

/** Find all trigger matches in `text`, sorted by their start position. */
function findTriggers(text: string): TriggerMatch[] {
  const found: Array<{ start: number; end: number; tool: TriggerMatch["tool"] }> = [];

  for (const { pattern, tool } of TRIGGERS) {
    pattern.lastIndex = 0;
    let m = pattern.exec(text);
    while (m !== null) {
      found.push({ start: m.index, end: m.index + m[0].length, tool });
      m = pattern.exec(text);
    }
  }

  // Sort by position
  found.sort((a, b) => a.start - b.start);

  // Remove overlaps: if a later trigger starts before a previous one ends, skip it
  const deduped: typeof found = [];
  let lastEnd = -1;
  for (const f of found) {
    if (f.start < lastEnd) continue;
    deduped.push(f);
    lastEnd = f.end;
  }

  return deduped.map((f) => ({ tool: f.tool, afterIndex: f.end }));
}

// ── Public API ─────────────────────────────────────────────────────────────

export function parseIntent(text: string, cwd: string): ToolCall[] {
  if (!text.trim()) return [];

  const triggers = findTriggers(text);
  if (triggers.length === 0) return [];

  const results: ToolCall[] = [];
  // Track intervals already "consumed" to avoid duplicate tool calls
  const _usedRanges: Array<[number, number]> = [];

  for (let i = 0; i < triggers.length; i++) {
    const { tool, afterIndex } = triggers[i];
    // The "after" text runs up to the next trigger start (or end of string)
    const _nextStart =
      i + 1 < triggers.length ? triggers[i + 1].afterIndex - /* back to trigger start */ 0 : text.length;

    // In practice we just use the full remaining text after the trigger;
    // extractors take the first match so they naturally stop at the right spot.
    const after = text.slice(afterIndex);

    if (tool === "bash") {
      const cmd = extractCommand(after);
      if (!cmd) continue;
      results.push({ tool: "bash", params: { command: cmd } });
    } else if (tool === "glob") {
      const pat = extractPattern(after);
      if (!pat) continue;
      results.push({ tool: "glob", params: { pattern: pat } });
    } else if (tool === "grep") {
      const pat = extractPattern(after);
      if (!pat) continue;
      results.push({ tool: "grep", params: { pattern: pat } });
    } else if (tool === "web_search") {
      const query =
        extractPattern(after) ??
        after
          .trim()
          .split(/\s*[.!?]$/)[0]
          .trim();
      if (!query) continue;
      results.push({ tool: "web_search", params: { query } });
    } else if (tool === "web_fetch") {
      // Extract URL from quoted or bare form
      const urlMatch = after.match(/`([^`]+)`/) ?? after.match(/"([^"]+)"/) ?? after.match(/(https?:\/\/\S+)/);
      if (!urlMatch) continue;
      results.push({ tool: "web_fetch", params: { url: urlMatch[1] } });
    } else {
      // read_file or list_dir — but the trigger only provides the *initial* guess.
      // Final tool is decided by the path itself.
      const allowBareDirFallback = tool === "list_dir";
      const rawPath = extractFilePath(after, allowBareDirFallback);
      if (!rawPath) continue;

      const finalTool = tool === "list_dir" ? "list_dir" : toolForPath(rawPath);
      const resolved = resolvePath(rawPath, cwd);
      results.push({ tool: finalTool, params: { path: resolved } });
    }
  }

  // Deduplicate by stringifying (same tool + same params)
  const seen = new Set<string>();
  return results.filter((tc) => {
    const key = JSON.stringify(tc);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
