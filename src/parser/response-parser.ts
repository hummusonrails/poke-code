import type { ParsedResponse, ToolCall } from "../types.js";

const TOOL_CALL_REGEX = /<tool_call>([\s\S]*?)<\/tool_call>/g;

export function parseResponse(raw: string): ParsedResponse {
  const textSegments: string[] = [];
  const toolCalls: ToolCall[] = [];

  if (!raw.trim()) {
    return { textSegments, toolCalls };
  }

  let lastIndex = 0;

  for (const match of raw.matchAll(TOOL_CALL_REGEX)) {
    const matchStart = match.index!;
    const matchEnd = matchStart + match[0].length;

    const textBefore = raw.slice(lastIndex, matchStart).trim();
    if (textBefore) {
      textSegments.push(textBefore);
    }

    const jsonStr = match[1].trim();
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.tool && typeof parsed.tool === "string" && parsed.params) {
        toolCalls.push({ tool: parsed.tool, params: parsed.params });
      } else {
        textSegments.push(match[0]);
      }
    } catch {
      textSegments.push(match[0]);
    }

    lastIndex = matchEnd;
  }

  const remaining = raw.slice(lastIndex).trim();
  if (remaining) {
    textSegments.push(remaining);
  }

  return { textSegments, toolCalls };
}
