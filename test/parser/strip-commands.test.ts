import { describe, expect, it } from "vitest";
import { stripCommands } from "../../src/parser/strip-commands.js";

describe("stripCommands", () => {
  it("strips bracket commands from text", () => {
    const input = `on it, starting with the source tree
[list] src/
[read] README.md`;
    expect(stripCommands(input)).toBe("on it, starting with the source tree");
  });

  it("preserves natural language between commands", () => {
    const input = `let me check a few things

[read] package.json

now let me look at the tests

[list] test/`;
    const result = stripCommands(input);
    expect(result).toContain("let me check a few things");
    expect(result).toContain("now let me look at the tests");
    expect(result).not.toContain("[read]");
    expect(result).not.toContain("[list]");
  });

  it("strips XML tool calls", () => {
    const input = 'hello <tool_call>{"tool":"read_file","params":{"path":"x"}}</tool_call> world';
    expect(stripCommands(input)).toBe("hello  world");
  });

  it("strips write blocks", () => {
    const input = `creating the file now
[write] src/hello.ts
export const x = 1;
[/write]
done!`;
    const result = stripCommands(input);
    expect(result).toContain("creating the file now");
    expect(result).toContain("done!");
    expect(result).not.toContain("[write]");
  });

  it("strips edit blocks", () => {
    const input = `fixing the bug
[edit] src/app.ts
[old]
const x = 1;
[/old]
[new]
const x = 2;
[/new]
all done`;
    const result = stripCommands(input);
    expect(result).toContain("fixing the bug");
    expect(result).toContain("all done");
    expect(result).not.toContain("[edit]");
    expect(result).not.toContain("[old]");
  });

  it("strips fragmented edit markup from split bubbles", () => {
    // When iMessage splits across bubbles, we get individual [old] [/old] etc.
    const input = `got the parser
[old]
const textForLineParsing = text.replace(/code/g, '');
for (const match of textForLineParsing.matchAll(BRACKET_LINE)) {
[/old]
[new]
const cleaned = stripCodeBlocks(text);
for (const match of cleaned.matchAll(BRACKET_LINE)) {
[/new]`;
    const result = stripCommands(input);
    expect(result).toBe("got the parser");
  });

  it("strips leaked code lines", () => {
    const input = `here's the fix
import { something } from './module.js';
const x = 1;
export function hello() {
  return 'world';
}
that should work now`;
    const result = stripCommands(input);
    expect(result).toContain("here's the fix");
    expect(result).toContain("that should work now");
    expect(result).not.toContain("import");
    expect(result).not.toContain("const x");
    expect(result).not.toContain("export function");
  });

  it("strips fenced code blocks", () => {
    const input = `check this out
\`\`\`typescript
const x = 1;
\`\`\`
pretty cool right`;
    const result = stripCommands(input);
    expect(result).toContain("check this out");
    expect(result).toContain("pretty cool right");
    expect(result).not.toContain("const x");
  });

  it("strips bare bracket tags", () => {
    expect(stripCommands("[list]")).toBe("");
    expect(stripCommands("[read]")).toBe("");
  });

  it("collapses excess blank lines", () => {
    const input = `hello


[read] file.txt


world`;
    const result = stripCommands(input);
    expect(result).not.toMatch(/\n{3,}/);
  });

  it("returns empty string for commands-only input", () => {
    expect(stripCommands("[read] package.json")).toBe("");
    expect(stripCommands("[list] src/\n[read] README.md")).toBe("");
  });

  it("handles empty input", () => {
    expect(stripCommands("")).toBe("");
  });
});
