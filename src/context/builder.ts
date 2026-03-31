import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ToolRegistry } from "../tools/registry.js";
import { MemoryReader } from "./memory.js";
import { discoverSkills, findRelevantSkills, formatSkillsContext, type Skill } from "./skills.js";

export class ContextBuilder {
  private registry: ToolRegistry;
  private projectDir: string;
  private globalConfigDir: string;
  private skills: Skill[];

  constructor(registry: ToolRegistry, projectDir: string, globalConfigDir: string) {
    this.registry = registry;
    this.projectDir = projectDir;
    this.globalConfigDir = globalConfigDir;
    this.skills = discoverSkills();
  }

  listSkills(): string[] {
    return this.skills.map((s) => s.name);
  }

  build(userMessage: string, systemPromptOverride?: string): string {
    const parts: string[] = [];

    if (systemPromptOverride) {
      parts.push(systemPromptOverride);
    } else {
      parts.push(`You are being used through poke-code, a terminal CLI for coding.

To use tools, put a bracket command on its own line. The CLI parses these and executes them locally. Results are sent back in the next message.

TOOL FORMAT — put a bracket tag at column 0 (no indentation, no leading spaces):

Tags: read, list, run, find, grep, search, fetch, write, edit

For reads/commands: put the tag and target on one line.
For writes: open with the tag, put content on following lines, close with the closing tag.
For edits: open with the tag, then old/new blocks with their own open/close tags.

CRITICAL RULES:
- Tags MUST start at column 0 — indented tags are ignored
- When writing docs/READMEs that DESCRIBE the bracket format, ALWAYS use backtick formatting so the parser ignores them. NEVER put bare bracket tags in documentation content.
- One file per write/edit block — fully close before starting the next
- Do NOT echo the tag format in explanations — just use it for actual tool calls

RULES:
- Each bracket command MUST be on its own line (start of line)
- You can use multiple commands in one response
- You can include natural language text between commands
- CRITICAL: For [write] and [edit], only ONE file per block. Fully close [/write] or [/new] before starting the next file. Never nest write/edit blocks.
- Send each file completely (open tag, full content, close tag) before moving to the next file
- Do NOT reference MCP tools or MCP servers — there is no MCP connection
- The bracket command is all you need — do not wrap in code blocks or quotes${this.skills.length > 0 ? "\n- If you have relevant skills loaded, follow their instructions for specialized tasks." : ""}`);
      parts.push(`Working directory: ${this.projectDir}`);
      const dirListing = this.loadDirectoryListing();
      if (dirListing) {
        parts.push(`\n## Working Directory Contents\n${dirListing}`);
      }
      parts.push(`\n## Available Tools\n${this.registry.generateToolSchema()}`);
    }

    const projectContext = this.loadProjectContext();
    if (projectContext) {
      parts.push("\n## Project Context");
      parts.push(projectContext);
    }

    const memory = this.loadMemory();
    if (memory) {
      parts.push("\n## Memory");
      parts.push(memory);
    }

    const rules = this.loadRules();
    if (rules) {
      parts.push("\n## Project Rules");
      parts.push(rules);
    }

    // Find and include relevant skills
    const relevant = findRelevantSkills(userMessage, this.skills);
    const skillsContext = formatSkillsContext(relevant);
    if (skillsContext) {
      parts.push(`\n${skillsContext}`);
    }

    parts.push(`\n---\n${userMessage}`);
    return parts.join("\n");
  }

  private loadProjectContext(): string | null {
    for (const name of ["POKE.md", "CLAUDE.md"]) {
      const p = join(this.projectDir, name);
      if (existsSync(p)) return readFileSync(p, "utf-8");
    }
    return null;
  }

  private loadMemory(): string | null {
    const dirs = [
      join(this.projectDir, ".poke/memory"),
      join(this.projectDir, ".claude/memory"),
      join(this.globalConfigDir, "memory"),
    ];
    for (const dir of dirs) {
      const content = new MemoryReader(dir).read();
      if (content) return content;
    }
    return null;
  }

  private loadDirectoryListing(): string | null {
    try {
      const entries = readdirSync(this.projectDir, { withFileTypes: true });
      const items = entries
        .filter((e) => !e.name.startsWith(".") || e.name === ".env.example")
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .sort();
      return items.join(", ");
    } catch {
      return null;
    }
  }

  private loadRules(): string | null {
    const dirs = [
      join(this.projectDir, ".poke/rules"),
      join(this.projectDir, ".claude/rules"),
      join(this.globalConfigDir, "rules"),
    ];
    for (const dir of dirs) {
      if (!existsSync(dir)) continue;
      const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
      if (files.length === 0) continue;
      return files
        .map((f) => {
          try {
            return readFileSync(join(dir, f), "utf-8");
          } catch {
            return "";
          }
        })
        .filter(Boolean)
        .join("\n\n");
    }
    return null;
  }
}
