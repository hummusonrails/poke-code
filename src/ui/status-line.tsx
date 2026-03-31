import { Box, Text } from "ink";

interface StatusLineProps {
  sessionId: string;
  messageCount: number;
  elapsed: string;
  cwd: string;
  permissionMode: string;
  multiLine?: boolean;
}

export function StatusLine({ sessionId, messageCount, elapsed, cwd, permissionMode, multiLine }: StatusLineProps) {
  return (
    <Box justifyContent="space-between" width="100%">
      <Text color="gray">{multiLine ? "Ctrl+D send | Ctrl+E exit multi" : "? for shortcuts | Ctrl+E multi-line"}</Text>
      <Text color="gray">mode:{permissionMode}</Text>
    </Box>
  );
}
