import { Box, Text } from "ink";
import type { ToolCall } from "../types.js";

const POKE = {
  blue: "#4a7cc9",
  muted: "#5a7a9a",
  dim: "#3d5a7a",
};

interface PermissionPromptProps {
  toolCall: ToolCall;
}

function describeAction(toolCall: ToolCall): string {
  const p = toolCall.params;
  switch (toolCall.tool) {
    case "write_file":
      return `Write to ${p.path}`;
    case "edit_file":
      return `Edit ${p.path}`;
    case "bash":
      return `Run command: ${p.command}`;
    case "read_file":
      return `Read ${p.path}`;
    case "list_dir":
      return `List directory ${p.path}`;
    case "glob":
      return `Find files matching ${p.pattern}`;
    case "grep":
      return `Search for "${p.pattern}"`;
    case "web_search":
      return `Search the web for "${p.query}"`;
    case "web_fetch":
      return `Fetch URL ${p.url}`;
    default:
      return `${toolCall.tool}: ${JSON.stringify(p)}`;
  }
}

export function PermissionPrompt({ toolCall }: PermissionPromptProps) {
  const description = describeAction(toolCall);
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1}>
      <Text color="yellow" bold>
        Poke wants to:
      </Text>
      <Text color="white" bold>
        {" "}
        {description}
      </Text>
      <Text> </Text>
      <Text color={POKE.muted}> y = allow n = deny a = always allow {toolCall.tool}</Text>
    </Box>
  );
}
