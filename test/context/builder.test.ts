import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContextBuilder } from "../../src/context/builder.js";
import { ToolRegistry } from "../../src/tools/registry.js";

const FIXTURES_DIR = join(import.meta.dirname, "__fixtures__", "builder");

function makeBuilder(projectDir: string, globalConfigDir: string): ContextBuilder {
  return new ContextBuilder(new ToolRegistry(), projectDir, globalConfigDir);
}

describe("ContextBuilder", () => {
  beforeEach(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  it("includes system prompt with natural language instruction", () => {
    const projectDir = join(FIXTURES_DIR, "schema-test");
    const globalDir = join(FIXTURES_DIR, "schema-global");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(globalDir, { recursive: true });
    const builder = makeBuilder(projectDir, globalDir);
    const result = builder.build("hello");
    expect(result).toContain("poke-code");
    expect(result).toContain("natural language");
  });

  it("includes user message at the end", () => {
    const projectDir = join(FIXTURES_DIR, "msg-test");
    const globalDir = join(FIXTURES_DIR, "msg-global");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(globalDir, { recursive: true });
    const builder = makeBuilder(projectDir, globalDir);
    const result = builder.build("my test message");
    expect(result).toContain("my test message");
  });

  it("includes working directory in rules", () => {
    const projectDir = join(FIXTURES_DIR, "wd-test");
    const globalDir = join(FIXTURES_DIR, "wd-global");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(globalDir, { recursive: true });
    const builder = makeBuilder(projectDir, globalDir);
    const result = builder.build("hello");
    expect(result).toContain(`Working directory: ${projectDir}`);
  });

  it("loads POKE.md as project context", () => {
    const projectDir = join(FIXTURES_DIR, "poke-md");
    const globalDir = join(FIXTURES_DIR, "poke-global");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(join(projectDir, "POKE.md"), "# Poke Project\npoke instructions here", "utf-8");
    const builder = makeBuilder(projectDir, globalDir);
    const result = builder.build("hello");
    expect(result).toContain("Project Context");
    expect(result).toContain("poke instructions here");
  });

  it("falls back to CLAUDE.md when POKE.md is absent", () => {
    const projectDir = join(FIXTURES_DIR, "claude-md");
    const globalDir = join(FIXTURES_DIR, "claude-global");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(join(projectDir, "CLAUDE.md"), "# Claude instructions", "utf-8");
    const builder = makeBuilder(projectDir, globalDir);
    const result = builder.build("hello");
    expect(result).toContain("Project Context");
    expect(result).toContain("Claude instructions");
  });

  it("prefers POKE.md over CLAUDE.md when both exist", () => {
    const projectDir = join(FIXTURES_DIR, "prefer-poke");
    const globalDir = join(FIXTURES_DIR, "prefer-global");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(join(projectDir, "POKE.md"), "poke content", "utf-8");
    writeFileSync(join(projectDir, "CLAUDE.md"), "claude content", "utf-8");
    const builder = makeBuilder(projectDir, globalDir);
    const result = builder.build("hello");
    expect(result).toContain("poke content");
    expect(result).not.toContain("claude content");
  });

  it("loads rules from .poke/rules directory", () => {
    const projectDir = join(FIXTURES_DIR, "rules-test");
    const globalDir = join(FIXTURES_DIR, "rules-global");
    const rulesDir = join(projectDir, ".poke", "rules");
    mkdirSync(rulesDir, { recursive: true });
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(join(rulesDir, "style.md"), "always use TypeScript", "utf-8");
    const builder = makeBuilder(projectDir, globalDir);
    const result = builder.build("hello");
    expect(result).toContain("Project Rules");
    expect(result).toContain("always use TypeScript");
  });

  it("uses system prompt override when provided", () => {
    const projectDir = join(FIXTURES_DIR, "override-test");
    const globalDir = join(FIXTURES_DIR, "override-global");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(globalDir, { recursive: true });
    const builder = makeBuilder(projectDir, globalDir);
    const result = builder.build("hello", "custom system prompt");
    expect(result).toContain("custom system prompt");
    // The default prompt (containing "terminal CLI") should not appear when overridden
    expect(result).not.toContain("terminal CLI");
  });

  it("includes memory when present in .poke/memory", () => {
    const projectDir = join(FIXTURES_DIR, "memory-test");
    const globalDir = join(FIXTURES_DIR, "memory-global");
    const memDir = join(projectDir, ".poke", "memory");
    mkdirSync(memDir, { recursive: true });
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(join(memDir, "MEMORY.md"), "# Project Memory", "utf-8");
    const builder = makeBuilder(projectDir, globalDir);
    const result = builder.build("hello");
    expect(result).toContain("Memory");
    expect(result).toContain("Project Memory");
  });

  it("does not include Project Context section when no context files exist", () => {
    const projectDir = join(FIXTURES_DIR, "no-context");
    const globalDir = join(FIXTURES_DIR, "no-context-global");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(globalDir, { recursive: true });
    const builder = makeBuilder(projectDir, globalDir);
    const result = builder.build("hello");
    expect(result).not.toContain("Project Context");
  });
});
