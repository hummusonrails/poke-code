import { Box, Text } from "ink";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

// Configure marked for terminal output.
// @types/marked-terminal is stale — the runtime markedTerminal() returns a
// MarkedExtension object, not a TerminalRenderer.  Cast to any to bypass it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
marked.use(
  markedTerminal({
    reflowText: true,
    width: Math.min(process.stdout.columns ?? 80, 120) - 4, // leave margin
    showSectionPrefix: false,
    tab: 2,
  }) as any,
);

function renderMarkdown(text: string): string {
  try {
    // marked with terminal renderer returns a string with ANSI codes
    return (marked.parse(text) as string).trimEnd();
  } catch {
    return text;
  }
}

interface MessageProps {
  role: "user" | "assistant" | "system";
  content: string;
}

export function MessageView({ role, content }: MessageProps) {
  if (role === "user") {
    return (
      <Box marginBottom={1}>
        <Text color="white" bold>
          {content}
        </Text>
      </Box>
    );
  }

  if (role === "assistant") {
    const rendered = renderMarkdown(content);
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text color="#4a7cc9" bold>
          Poke{" "}
        </Text>
        <Text>{rendered}</Text>
      </Box>
    );
  }

  // system
  return (
    <Box marginBottom={1}>
      <Text color="gray">{content}</Text>
    </Box>
  );
}
