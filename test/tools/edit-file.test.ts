import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { editFileTool } from "../../src/tools/edit-file.js";

const fixturesDir = join(import.meta.dirname, "__fixtures__", "edit-file");
const filePath = join(fixturesDir, "sample.txt");

beforeAll(() => {
  mkdirSync(fixturesDir, { recursive: true });
});

afterAll(() => {
  rmSync(fixturesDir, { recursive: true, force: true });
});

beforeEach(() => {
  writeFileSync(filePath, "foo bar foo baz foo");
});

describe("editFileTool", () => {
  it("replaces first unique occurrence", async () => {
    writeFileSync(filePath, "hello world");
    const result = await editFileTool({ path: filePath, old_string: "hello", new_string: "goodbye" });
    expect(result).toContain("Replaced 1 occurrence");
    expect(readFileSync(filePath, "utf-8")).toBe("goodbye world");
  });

  it("replaces all occurrences with replace_all flag", async () => {
    const result = await editFileTool({ path: filePath, old_string: "foo", new_string: "qux", replace_all: true });
    expect(result).toContain("3 occurrence(s)");
    expect(readFileSync(filePath, "utf-8")).toBe("qux bar qux baz qux");
  });

  it("throws when old_string is not found", async () => {
    await expect(editFileTool({ path: filePath, old_string: "notexist", new_string: "x" })).rejects.toThrow(
      "old_string not found",
    );
  });

  it("throws on ambiguous match without replace_all", async () => {
    await expect(editFileTool({ path: filePath, old_string: "foo", new_string: "qux" })).rejects.toThrow("ambiguous");
  });

  it("replaces single occurrence when string appears exactly once", async () => {
    writeFileSync(filePath, "only once here");
    const result = await editFileTool({ path: filePath, old_string: "only once", new_string: "just one" });
    expect(result).toContain("Replaced 1 occurrence");
    expect(readFileSync(filePath, "utf-8")).toBe("just one here");
  });

  it("returns diff preview in output", async () => {
    const diffFilePath = join(fixturesDir, "diff-test.txt");
    writeFileSync(diffFilePath, "hello world\nfoo bar\n");

    const result = await editFileTool({
      path: diffFilePath,
      old_string: "hello world",
      new_string: "hello poke",
    });

    expect(result).toContain("Replaced");
    expect(result).toContain("-hello world");
    expect(result).toContain("+hello poke");
  });
});
