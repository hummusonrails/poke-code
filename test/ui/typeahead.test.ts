import { describe, expect, it } from "vitest";
import { type CommandHint, matchCommands } from "../../src/ui/typeahead.js";

const COMMANDS: CommandHint[] = [
  { name: "help", description: "Show available commands" },
  { name: "history", description: "Show conversation history" },
  { name: "compact", description: "Compress context" },
  { name: "clear", description: "Clear the screen" },
  { name: "copy", description: "Copy last response" },
  { name: "permissions", description: "Switch permission mode" },
];

describe("matchCommands", () => {
  it("returns all commands for empty prefix", () => {
    const result = matchCommands("/", COMMANDS);
    expect(result).toHaveLength(COMMANDS.length);
  });

  it("filters by prefix", () => {
    const result = matchCommands("/c", COMMANDS);
    expect(result.map((r) => r.name)).toEqual(["compact", "clear", "copy"]);
  });

  it("returns empty for no match", () => {
    const result = matchCommands("/z", COMMANDS);
    expect(result).toHaveLength(0);
  });

  it("returns empty for non-slash input", () => {
    const result = matchCommands("hello", COMMANDS);
    expect(result).toHaveLength(0);
  });

  it("matches single character", () => {
    const result = matchCommands("/h", COMMANDS);
    expect(result.map((r) => r.name)).toEqual(["help", "history"]);
  });
});
