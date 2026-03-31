import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listDirTool } from "../../src/tools/list-dir.js";

const fixturesDir = join(import.meta.dirname, "__fixtures__", "list-dir");

beforeAll(() => {
  mkdirSync(join(fixturesDir, "subdir"), { recursive: true });
  mkdirSync(join(fixturesDir, "empty"), { recursive: true });
  writeFileSync(join(fixturesDir, "alpha.txt"), "");
  writeFileSync(join(fixturesDir, "beta.txt"), "");
});

afterAll(() => {
  rmSync(fixturesDir, { recursive: true, force: true });
});

describe("listDirTool", () => {
  it("lists files and directories", async () => {
    const result = await listDirTool({ path: fixturesDir });
    const entries = result.split("\n");
    expect(entries).toContain("alpha.txt");
    expect(entries).toContain("beta.txt");
  });

  it("suffixes directories with /", async () => {
    const result = await listDirTool({ path: fixturesDir });
    const entries = result.split("\n");
    expect(entries).toContain("subdir/");
    expect(entries).toContain("empty/");
  });

  it("returns sorted entries", async () => {
    const result = await listDirTool({ path: fixturesDir });
    const entries = result.split("\n");
    expect(entries).toEqual([...entries].sort());
  });

  it("returns (empty directory) for empty dir", async () => {
    const result = await listDirTool({ path: join(fixturesDir, "empty") });
    expect(result).toBe("(empty directory)");
  });

  it("throws on nonexistent directory", async () => {
    await expect(listDirTool({ path: join(fixturesDir, "does-not-exist") })).rejects.toThrow();
  });
});
