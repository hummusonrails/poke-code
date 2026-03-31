import { describe, expect, it } from "vitest";
import { bashTool } from "../../src/tools/bash.js";

describe("bashTool", () => {
  it("executes a simple command and returns stdout", async () => {
    const result = await bashTool({ command: "echo hello" });
    expect(result.trim()).toBe("hello");
  });

  it("captures stderr output", async () => {
    const result = await bashTool({ command: "echo error >&2" });
    expect(result).toContain("error");
  });

  it("returns (no output) when command produces no output", async () => {
    const result = await bashTool({ command: "true" });
    expect(result).toBe("(no output)");
  });

  it("throws on timeout", async () => {
    await expect(bashTool({ command: "sleep 5", timeout: 100 })).rejects.toThrow(/timed out/i);
  }, 10_000);

  it("throws with exit code on command failure", async () => {
    await expect(bashTool({ command: "exit 1" })).rejects.toThrow(/exit code/i);
  });

  it("includes command output in failure error", async () => {
    await expect(bashTool({ command: "echo failure_output && exit 2" })).rejects.toThrow(/failure_output/);
  });
});
