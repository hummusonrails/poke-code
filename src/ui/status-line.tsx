import { Box, Text } from "ink";

interface StatusLineProps {
  sessionId: string;
  messageCount: number;
  elapsed: string;
  cwd: string;
  permissionMode: string;
  multiLine?: boolean;
  toolCount?: number;
}

export function StatusLine({ sessionId, messageCount, elapsed, cwd, permissionMode, multiLine, toolCount }: StatusLineProps) {
  const shortCwd = cwd.replace(process.env.HOME ?? "", "~");

  return (
    <Box justifyContent="space-between" width="100%">
      <Box>
        <Text color="gray">
          {multiLine
            ? "Ctrl+D send | Ctrl+E exit multi"
            : "↑↓ history | Ctrl+E multi-line | /help"}
        </Text>
      </Box>
      <Box gap={2}>
        {toolCount !== undefined && toolCount > 0 && (
          <Text color="gray">{toolCount} tools</Text>
        )}
        <Text color="gray">{messageCount}msg</Text>
        <Text color="gray">{elapsed}</Text>
        <Text color="gray">{shortCwd}</Text>
        <Text color="gray">mode:{permissionMode}</Text>
      </Box>
    </Box>
  );
}
