import { createPatch } from "diff";
import { Box, Text } from "ink";

interface DiffViewProps {
  filePath: string;
  oldContent: string;
  newContent: string;
  context?: number; // lines of context around changes, default 3
}

export function DiffView({ filePath, oldContent, newContent, context = 3 }: DiffViewProps) {
  const patch = createPatch(filePath, oldContent, newContent, "", "", { context });
  const lines = patch.split("\n").slice(4); // skip header lines

  return (
    <Box flexDirection="column" marginLeft={2}>
      {lines.map((line, i) => {
        if (line.startsWith("+")) {
          return (
            <Text key={i} color="green">
              {line}
            </Text>
          );
        }
        if (line.startsWith("-")) {
          return (
            <Text key={i} color="red">
              {line}
            </Text>
          );
        }
        if (line.startsWith("@@")) {
          return (
            <Text key={i} color="cyan" dimColor>
              {line}
            </Text>
          );
        }
        return (
          <Text key={i} color="gray">
            {line}
          </Text>
        );
      })}
    </Box>
  );
}

/**
 * Generate a plain-text colored diff string for non-React contexts.
 */
export function formatDiff(filePath: string, oldContent: string, newContent: string, context = 3): string {
  const patch = createPatch(filePath, oldContent, newContent, "", "", { context });
  return patch.split("\n").slice(4).join("\n");
}
