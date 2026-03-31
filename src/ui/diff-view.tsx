import { createPatch, diffWords } from "diff";
import { Box, Text } from "ink";

export interface WordDiffResult {
  removed: string[];
  added: string[];
}

export function computeWordDiff(oldStr: string, newStr: string): WordDiffResult {
  const changes = diffWords(oldStr, newStr);
  const removed: string[] = [];
  const added: string[] = [];
  for (const change of changes) {
    if (change.removed) removed.push(change.value.trim());
    if (change.added) added.push(change.value.trim());
  }
  return { removed: removed.filter(Boolean), added: added.filter(Boolean) };
}

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
        const k = i;
        if (line.startsWith("+")) {
          // biome-ignore lint/suspicious/noArrayIndexKey: diff lines have no stable identity; index is safe here
          return (
            <Text key={k} color="#4caf50">
              {line}
            </Text>
          );
        }
        if (line.startsWith("-")) {
          // biome-ignore lint/suspicious/noArrayIndexKey: diff lines have no stable identity; index is safe here
          return (
            <Text key={k} color="#e05252">
              {line}
            </Text>
          );
        }
        if (line.startsWith("@@")) {
          // biome-ignore lint/suspicious/noArrayIndexKey: diff lines have no stable identity; index is safe here
          return (
            <Text key={k} color="cyan" dimColor>
              {line}
            </Text>
          );
        }
        // biome-ignore lint/suspicious/noArrayIndexKey: diff lines have no stable identity; index is safe here
        return (
          <Text key={k} color="gray">
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
