import path from "node:path";
import type { ToolCall } from "../types.js";

/**
 * Parse Poke's bracket-format tool commands from response text.
 *
 * Format:  [tag] target
 *
 * Supported tags:
 *   [read] path           → read_file
 *   [read] path:10-20     → read_file with offset/limit
 *   [run] command          → bash
 *   [list] path            → list_dir
 *   [find] pattern         → glob
 *   [grep] pattern         → grep
 *   [grep] pattern *.ext   → grep with file filter
 *   [write] path           → write_file (requires content block)
 *   [edit] path            → edit_file (requires old/new blocks)
 *
 * Write format:
 *   [write] path/to/file.ts
 *   ```
 *   file content here
 *   ```
 *
 * Edit format:
 *   [edit] path/to/file.ts
 *   [old]
 *   original text
 *   [/old]
 *   [new]
 *   replacement text
 *   [/new]
 */

const TAG_MAP: Record<string, string> = {
  read: "read_file",
  run: "bash",
  list: "list_dir",
  find: "glob",
  grep: "grep",
  search: "web_search",
  fetch: "web_fetch",
  write: "write_file",
  edit: "edit_file",
};

/** Match [tag] at column 0 (no leading whitespace) optionally followed by content. */
const BRACKET_LINE = /^(?!\s)\[(\w+)\](?:\s+(.+))?$/gm;

/** Match [read] path:start-end for line ranges. */
const LINE_RANGE = /^(.+):(\d+)-(\d+)$/;

/** Match [grep] pattern *.ext for file filter. */
const GREP_WITH_GLOB = /^(.+?)\s+(\*\.\w+)$/;

/** Match [write] at column 0 ... [/write] block. Supports nested code fences. */
const WRITE_BLOCK = /^(?!\s)\[write\]\s+(.+)\n([\s\S]*?)^\[\/write\]/gm;

/** Match [edit] at column 0 with [old]...[/old] [new]...[/new] blocks. */
const EDIT_BLOCK = /^(?!\s)\[edit\]\s+(.+)\n\[old\]\n([\s\S]*?)\[\/old\]\n\[new\]\n([\s\S]*?)\[\/new\]/gm;

/** Reject targets that look like system prompt examples, not real commands. */
function isExampleTarget(target: string): boolean {
  return target.startsWith("path/to/") || target === "file.ts" || target === "argument";
}

export function parseBrackets(text: string, cwd: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const processedPaths = new Set<string>();

  // First pass: multi-line write blocks
  for (const match of text.matchAll(WRITE_BLOCK)) {
    const filePath = match[1].trim();
    if (isExampleTarget(filePath)) continue;
    const content = match[2];
    const resolved = path.resolve(cwd, filePath);
    calls.push({ tool: "write_file", params: { path: resolved, content } });
    processedPaths.add(filePath);
  }

  // Second pass: multi-line edit blocks
  for (const match of text.matchAll(EDIT_BLOCK)) {
    const filePath = match[1].trim();
    if (isExampleTarget(filePath)) continue;
    const oldString = match[2].trimEnd();
    const newString = match[3].trimEnd();
    const resolved = path.resolve(cwd, filePath);
    calls.push({
      tool: "edit_file",
      params: { path: resolved, old_string: oldString, new_string: newString },
    });
    processedPaths.add(filePath);
  }

  // Third pass: single-line bracket commands
  for (const match of text.matchAll(BRACKET_LINE)) {
    const tag = match[1].toLowerCase();
    const target = (match[2] ?? "").trim();
    const tool = TAG_MAP[tag];

    if (!tool) continue;

    // Skip example/placeholder targets from system prompt echoes
    if (target && isExampleTarget(target)) continue;

    // Skip write/edit if already handled by multi-line pass
    if ((tag === "write" || tag === "edit") && processedPaths.has(target)) continue;

    switch (tool) {
      case "read_file": {
        if (!target) break; // read requires a path
        const rangeMatch = target.match(LINE_RANGE);
        if (rangeMatch) {
          const filePath = rangeMatch[1].trim();
          const start = parseInt(rangeMatch[2], 10);
          const end = parseInt(rangeMatch[3], 10);
          calls.push({
            tool: "read_file",
            params: {
              path: path.resolve(cwd, filePath),
              offset: start,
              limit: end - start + 1,
            },
          });
        } else {
          calls.push({
            tool: "read_file",
            params: { path: path.resolve(cwd, target) },
          });
        }
        break;
      }

      case "bash":
        if (!target) break; // run requires a command
        calls.push({ tool: "bash", params: { command: target } });
        break;

      case "list_dir":
        // [list] with no path defaults to cwd
        calls.push({
          tool: "list_dir",
          params: { path: target ? path.resolve(cwd, target) : cwd },
        });
        break;

      case "glob":
        if (!target) break;
        calls.push({ tool: "glob", params: { pattern: target, path: cwd } });
        break;

      case "grep": {
        if (!target) break;
        const grepMatch = target.match(GREP_WITH_GLOB);
        if (grepMatch) {
          calls.push({
            tool: "grep",
            params: { pattern: grepMatch[1].trim(), glob: grepMatch[2], path: cwd },
          });
        } else {
          calls.push({ tool: "grep", params: { pattern: target, path: cwd } });
        }
        break;
      }

      case "web_search":
        if (!target) break;
        calls.push({ tool: "web_search", params: { query: target } });
        break;

      case "web_fetch":
        if (!target) break;
        calls.push({ tool: "web_fetch", params: { url: target } });
        break;

      case "write_file":
        // Single-line [write] without content block — skip (no content to write)
        break;

      case "edit_file":
        // Single-line [edit] without old/new blocks — skip
        break;
    }
  }

  return calls;
}
