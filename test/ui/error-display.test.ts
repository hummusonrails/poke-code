import { describe, expect, it } from "vitest";
import { formatErrorWithHint } from "../../src/ui/error-display.js";

describe("formatErrorWithHint", () => {
  it("adds Full Disk Access hint for permission errors", () => {
    const result = formatErrorWithHint("EPERM: operation not permitted");
    expect(result).toContain("Full Disk Access");
  });

  it("adds API key hint for auth errors", () => {
    const result = formatErrorWithHint("401 Unauthorized");
    expect(result).toContain("/apikey");
  });

  it("adds network hint for fetch errors", () => {
    const result = formatErrorWithHint("ECONNREFUSED");
    expect(result).toContain("network");
  });

  it("adds timeout hint", () => {
    const result = formatErrorWithHint("Command timed out after 120000ms");
    expect(result).toContain("timeout");
  });

  it("returns plain error for unknown patterns", () => {
    const result = formatErrorWithHint("Something weird happened");
    expect(result).toBe("Error: Something weird happened");
  });

  it("adds file not found hint", () => {
    const result = formatErrorWithHint("ENOENT: no such file or directory");
    expect(result).toContain("/doctor");
  });

  it("adds rate limit hint", () => {
    const result = formatErrorWithHint("429 Too Many Requests");
    expect(result).toContain("Rate limited");
  });
});
