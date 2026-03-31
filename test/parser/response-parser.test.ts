import { describe, expect, it } from "vitest";
import { parseResponse } from "../../src/parser/response-parser.js";

describe("parseResponse", () => {
  it("parses plain text with no tool calls", () => {
    const result = parseResponse("Just a regular message from Poke.");
    expect(result.textSegments).toEqual(["Just a regular message from Poke."]);
    expect(result.toolCalls).toEqual([]);
  });

  it("extracts a single tool call", () => {
    const input = `Let me read that file.

<tool_call>{"tool":"read_file","params":{"path":"src/index.ts"}}</tool_call>`;

    const result = parseResponse(input);
    expect(result.textSegments).toEqual(["Let me read that file."]);
    expect(result.toolCalls).toEqual([{ tool: "read_file", params: { path: "src/index.ts" } }]);
  });

  it("extracts multiple tool calls", () => {
    const input = `I'll check both files.

<tool_call>{"tool":"read_file","params":{"path":"a.ts"}}</tool_call>
<tool_call>{"tool":"read_file","params":{"path":"b.ts"}}</tool_call>`;

    const result = parseResponse(input);
    expect(result.textSegments).toEqual(["I'll check both files."]);
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0].params.path).toBe("a.ts");
    expect(result.toolCalls[1].params.path).toBe("b.ts");
  });

  it("handles text between tool calls", () => {
    const input = `First file:

<tool_call>{"tool":"read_file","params":{"path":"a.ts"}}</tool_call>

Now the second:

<tool_call>{"tool":"read_file","params":{"path":"b.ts"}}</tool_call>`;

    const result = parseResponse(input);
    expect(result.textSegments).toEqual(["First file:", "Now the second:"]);
    expect(result.toolCalls).toHaveLength(2);
  });

  it("handles tool call with complex params", () => {
    const input = `<tool_call>{"tool":"edit_file","params":{"path":"src/app.ts","old_string":"const x = 1;","new_string":"const x = 2;","replace_all":false}}</tool_call>`;

    const result = parseResponse(input);
    expect(result.toolCalls[0]).toEqual({
      tool: "edit_file",
      params: {
        path: "src/app.ts",
        old_string: "const x = 1;",
        new_string: "const x = 2;",
        replace_all: false,
      },
    });
  });

  it("handles malformed tool call gracefully", () => {
    const input = `Here's the result.

<tool_call>not valid json</tool_call>

Moving on.`;

    const result = parseResponse(input);
    expect(result.textSegments).toEqual(["Here's the result.", "<tool_call>not valid json</tool_call>", "Moving on."]);
    expect(result.toolCalls).toEqual([]);
  });

  it("handles empty input", () => {
    const result = parseResponse("");
    expect(result.textSegments).toEqual([]);
    expect(result.toolCalls).toEqual([]);
  });

  it("handles tool call with multiline content in params", () => {
    const content = "line1\nline2\nline3";
    const input = `<tool_call>{"tool":"write_file","params":{"path":"test.txt","content":${JSON.stringify(content)}}}</tool_call>`;

    const result = parseResponse(input);
    expect(result.toolCalls[0].params.content).toBe(content);
  });
});
