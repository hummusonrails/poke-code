import { describe, expect, it } from "vitest";
import { hasIncompleteBlock } from "../../src/parser/incomplete-check.js";

describe("hasIncompleteBlock", () => {
  it("detects unclosed [write] block", () => {
    expect(hasIncompleteBlock("[write] README.md\n# Hello")).toBe(true);
  });

  it("passes complete [write] block", () => {
    expect(hasIncompleteBlock("[write] README.md\n# Hello\n[/write]")).toBe(false);
  });

  it("detects unclosed [edit] block (missing [/old])", () => {
    expect(hasIncompleteBlock("[edit] file.ts\n[old]\nconst x = 1;")).toBe(true);
  });

  it("detects unclosed [edit] block (missing [/new])", () => {
    expect(hasIncompleteBlock("[edit] file.ts\n[old]\nconst x = 1;\n[/old]\n[new]\nconst x = 2;")).toBe(true);
  });

  it("passes complete [edit] block", () => {
    expect(hasIncompleteBlock("[edit] file.ts\n[old]\nconst x = 1;\n[/old]\n[new]\nconst x = 2;\n[/new]")).toBe(false);
  });

  it("returns false for text with no blocks", () => {
    expect(hasIncompleteBlock("just regular text")).toBe(false);
  });

  it("returns false for empty text", () => {
    expect(hasIncompleteBlock("")).toBe(false);
  });

  it("returns false for text with only bracket commands", () => {
    expect(hasIncompleteBlock("[read] package.json\n[list] src/")).toBe(false);
  });

  it("handles multiple write blocks", () => {
    expect(hasIncompleteBlock("[write] a.ts\ncontent\n[/write]\n[write] b.ts\ncontent")).toBe(true);
    expect(hasIncompleteBlock("[write] a.ts\ncontent\n[/write]\n[write] b.ts\ncontent\n[/write]")).toBe(false);
  });
});
