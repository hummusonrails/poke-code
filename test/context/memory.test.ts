import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryReader } from "../../src/context/memory.js";

const FIXTURES_DIR = join(import.meta.dirname, "__fixtures__", "memory");

function tempDir(suffix: string): string {
  const dir = join(FIXTURES_DIR, suffix);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("MemoryReader", () => {
  beforeEach(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  it("returns empty string when memory dir does not exist", () => {
    const reader = new MemoryReader(join(FIXTURES_DIR, "nonexistent"));
    expect(reader.read()).toBe("");
  });

  it("returns empty string when MEMORY.md is missing", () => {
    const dir = tempDir("no-index");
    writeFileSync(join(dir, "notes.md"), "some notes", "utf-8");
    const reader = new MemoryReader(dir);
    expect(reader.read()).toBe("");
  });

  it("returns MEMORY.md content when no other files", () => {
    const dir = tempDir("only-index");
    writeFileSync(join(dir, "MEMORY.md"), "# Memory Index\n- item one", "utf-8");
    const reader = new MemoryReader(dir);
    const result = reader.read();
    expect(result).toContain("# Memory Index");
    expect(result).toContain("item one");
  });

  it("reads MEMORY.md and appends referenced md files", () => {
    const dir = tempDir("with-refs");
    writeFileSync(join(dir, "MEMORY.md"), "# Index", "utf-8");
    writeFileSync(join(dir, "facts.md"), "fact one\nfact two", "utf-8");
    writeFileSync(join(dir, "context.md"), "project context", "utf-8");
    const reader = new MemoryReader(dir);
    const result = reader.read();
    expect(result).toContain("# Index");
    expect(result).toContain("### facts.md");
    expect(result).toContain("fact one");
    expect(result).toContain("### context.md");
    expect(result).toContain("project context");
  });

  it("does not include MEMORY.md again in the referenced files section", () => {
    const dir = tempDir("no-duplicate");
    writeFileSync(join(dir, "MEMORY.md"), "# Index", "utf-8");
    const reader = new MemoryReader(dir);
    const result = reader.read();
    // MEMORY.md should not appear in ### headers
    expect(result).not.toContain("### MEMORY.md");
  });
});
