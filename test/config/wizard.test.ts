import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyClaudeConfig, renameClaudeToPokeFiles } from "../../src/config/wizard.js";

const FIXTURES_DIR = join(import.meta.dirname, "__fixtures__", "wizard");

function tempDir(suffix: string): string {
  const dir = join(FIXTURES_DIR, suffix);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("copyClaudeConfig", () => {
  beforeEach(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  it("does nothing when source claude dir does not exist", () => {
    const claudeDir = join(FIXTURES_DIR, "nonexistent-claude");
    const pokeDir = join(FIXTURES_DIR, "poke-out");
    copyClaudeConfig(claudeDir, pokeDir);
    expect(existsSync(pokeDir)).toBe(false);
  });

  it("copies claude dir to poke dir", () => {
    const claudeDir = tempDir("source-claude");
    const pokeDir = join(FIXTURES_DIR, "target-poke");
    writeFileSync(join(claudeDir, "settings.json"), '{"key":"value"}', "utf-8");
    copyClaudeConfig(claudeDir, pokeDir);
    expect(existsSync(pokeDir)).toBe(true);
    expect(existsSync(join(pokeDir, "settings.json"))).toBe(true);
  });

  it("does not overwrite existing poke dir", () => {
    const claudeDir = tempDir("overwrite-claude");
    const pokeDir = tempDir("overwrite-poke");
    writeFileSync(join(claudeDir, "new-file.txt"), "new content", "utf-8");
    writeFileSync(join(pokeDir, "existing-file.txt"), "existing content", "utf-8");
    copyClaudeConfig(claudeDir, pokeDir);
    // Should not have copied new-file from claude since poke already exists
    expect(existsSync(join(pokeDir, "new-file.txt"))).toBe(false);
    expect(existsSync(join(pokeDir, "existing-file.txt"))).toBe(true);
  });

  it("renames CLAUDE.md to POKE.md after copying", () => {
    const claudeDir = tempDir("rename-claude");
    const pokeDir = join(FIXTURES_DIR, "rename-poke");
    writeFileSync(join(claudeDir, "CLAUDE.md"), "# Claude instructions", "utf-8");
    copyClaudeConfig(claudeDir, pokeDir);
    expect(existsSync(join(pokeDir, "CLAUDE.md"))).toBe(false);
    expect(existsSync(join(pokeDir, "POKE.md"))).toBe(true);
    expect(readFileSync(join(pokeDir, "POKE.md"), "utf-8")).toBe("# Claude instructions");
  });
});

describe("renameClaudeToPokeFiles", () => {
  beforeEach(() => {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  it("does nothing when dir does not exist", () => {
    // Should not throw
    renameClaudeToPokeFiles(join(FIXTURES_DIR, "nonexistent"));
  });

  it("renames CLAUDE.md to POKE.md in the given directory", () => {
    const dir = tempDir("rename-top");
    writeFileSync(join(dir, "CLAUDE.md"), "content", "utf-8");
    renameClaudeToPokeFiles(dir);
    expect(existsSync(join(dir, "CLAUDE.md"))).toBe(false);
    expect(existsSync(join(dir, "POKE.md"))).toBe(true);
  });

  it("renames CLAUDE.md recursively in subdirectories", () => {
    const dir = tempDir("rename-recursive");
    const subdir = join(dir, "nested", "deep");
    mkdirSync(subdir, { recursive: true });
    writeFileSync(join(dir, "CLAUDE.md"), "top level", "utf-8");
    writeFileSync(join(subdir, "CLAUDE.md"), "nested", "utf-8");
    writeFileSync(join(subdir, "README.md"), "readme stays", "utf-8");
    renameClaudeToPokeFiles(dir);
    expect(existsSync(join(dir, "POKE.md"))).toBe(true);
    expect(existsSync(join(subdir, "POKE.md"))).toBe(true);
    expect(existsSync(join(dir, "CLAUDE.md"))).toBe(false);
    expect(existsSync(join(subdir, "CLAUDE.md"))).toBe(false);
    // Other .md files should be untouched
    expect(existsSync(join(subdir, "README.md"))).toBe(true);
  });

  it("leaves non-CLAUDE.md files untouched", () => {
    const dir = tempDir("no-rename");
    writeFileSync(join(dir, "other.md"), "other content", "utf-8");
    writeFileSync(join(dir, "notes.txt"), "notes", "utf-8");
    renameClaudeToPokeFiles(dir);
    expect(existsSync(join(dir, "other.md"))).toBe(true);
    expect(existsSync(join(dir, "notes.txt"))).toBe(true);
  });
});
