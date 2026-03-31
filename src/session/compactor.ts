import type { SessionEntry } from "../types.js";

export function compactHistory(entries: SessionEntry[]): string {
  if (entries.length === 0) return "";
  const parts: string[] = ["## Conversation Summary\n"];
  for (const entry of entries) {
    switch (entry.role) {
      case "user":
        parts.push(`- **User:** ${entry.content}`);
        break;
      case "assistant":
        if (entry.content) {
          const text = entry.content.length > 200 ? `${entry.content.slice(0, 200)}...` : entry.content;
          parts.push(`- **Poke:** ${text}`);
        }
        if (entry.toolCalls && entry.toolCalls.length > 0) {
          const toolNames = entry.toolCalls.map((tc) => {
            const key = tc.params.path ?? tc.params.command ?? tc.params.pattern ?? "";
            return `${tc.tool}(${key})`;
          });
          parts.push(`  - Tools used: ${toolNames.join(", ")}`);
        }
        break;
      case "tool":
        break; // Skip tool results in compact form
    }
  }
  return parts.join("\n");
}
