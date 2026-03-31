import { describe, expect, it } from "vitest";
import { computeWordDiff, formatDiff } from "../../src/ui/diff-view.js";

describe("computeWordDiff", () => {
  it("identifies changed words", () => {
    const result = computeWordDiff("hello world", "hello earth");
    expect(result.removed).toContain("world");
    expect(result.added).toContain("earth");
  });

  it("handles identical lines", () => {
    const result = computeWordDiff("same text", "same text");
    expect(result.removed).toEqual([]);
    expect(result.added).toEqual([]);
  });

  it("handles empty strings", () => {
    const result = computeWordDiff("", "new text");
    expect(result.added.length).toBeGreaterThan(0);
  });
});

describe("formatDiff", () => {
  it("generates a diff string", () => {
    const result = formatDiff("test.ts", "old content", "new content");
    expect(result).toContain("+");
    expect(result).toContain("-");
  });
});
