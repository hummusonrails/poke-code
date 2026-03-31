import { Box, Text } from "ink";
import type { ToolResult } from "../types.js";

// Poke brand colors
const POKE = {
  blue: "#4a7cc9",
  muted: "#5a7a9a",
  dim: "#3d5a7a",
};

interface ToolCallPendingProps {
  toolName: string;
  params: Record<string, unknown>;
}

/** Shows tool name and target before execution starts */
export function ToolCallPending({ toolName, params }: ToolCallPendingProps) {
  const label = params.path ?? params.command ?? params.pattern ?? params.query ?? params.url ?? "";
  const shortLabel = typeof label === "string" && label.length > 60 ? `...${label.slice(-57)}` : String(label);
  return (
    <Box>
      <Text color={POKE.dim}>{"  ⏳ "}</Text>
      <Text color={POKE.muted}>{shortToolName(toolName)}</Text>
      <Text color={POKE.dim}> {shortLabel}</Text>
    </Box>
  );
}

interface ToolCallViewProps {
  result: ToolResult;
  verbose?: boolean;
}

/** Shows completed tool with checkmark or X */
export function ToolCallDone({ result, verbose }: ToolCallViewProps) {
  const label = result.params.path ?? result.params.command ?? result.params.pattern ?? "";
  const isError = !!result.error;
  const shortLabel = typeof label === "string" && label.length > 60 ? `...${label.slice(-57)}` : String(label);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isError ? "#e05252" : "#4caf50"}>{isError ? "  ✗ " : "  ✓ "}</Text>
        <Text color={isError ? "#e05252" : POKE.muted}>{shortToolName(result.tool)}</Text>
        <Text color={POKE.dim}> {shortLabel}</Text>
        {isError && <Text color="#e05252"> — {(result.error ?? "").slice(0, 60)}</Text>}
      </Box>
      {verbose && (
        <Box marginLeft={4}>
          <Text color="gray">{(result.error ?? result.output ?? "").slice(0, 200)}</Text>
        </Box>
      )}
    </Box>
  );
}

/** Compact single-line view for one tool result. */
export function ToolCallView({ result, verbose }: ToolCallViewProps) {
  const label = result.params.path ?? result.params.command ?? result.params.pattern ?? "";
  const isError = !!result.error;
  const shortLabel = typeof label === "string" && label.length > 60 ? `...${label.slice(-57)}` : String(label);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isError ? "red" : POKE.dim}>{isError ? "✗" : "◆"} </Text>
        <Text color={isError ? "red" : POKE.muted}>{result.tool}</Text>
        <Text color={POKE.dim}> {shortLabel}</Text>
      </Box>
      {verbose && (
        <Box marginLeft={4}>
          <Text color="gray">{(result.error ?? result.output ?? "").slice(0, 200)}</Text>
        </Box>
      )}
    </Box>
  );
}

interface ToolSummaryProps {
  results: ToolResult[];
  verbose?: boolean;
}

/** Compact summary of a batch of tool results. */
export function ToolSummary({ results, verbose }: ToolSummaryProps) {
  if (results.length === 0) return null;

  const errors = results.filter((r) => r.error);
  const counts = new Map<string, number>();
  for (const r of results) {
    counts.set(r.tool, (counts.get(r.tool) ?? 0) + 1);
  }

  const summary = Array.from(counts.entries())
    .map(([tool, count]) => (count > 1 ? `${count} ${shortToolName(tool)}` : shortToolName(tool)))
    .join(", ");

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={POKE.dim}>{"  ◆ "}</Text>
        <Text color={POKE.muted}>{summary}</Text>
        {errors.length > 0 && <Text color="red"> ({errors.length} failed)</Text>}
      </Box>
      {/* biome-ignore lint/suspicious/noArrayIndexKey: tool results have no stable id; order is fixed */}
      {verbose && results.map((r, i) => <ToolCallView key={`tool-${i}`} result={r} verbose />)}
    </Box>
  );
}

function shortToolName(tool: string): string {
  switch (tool) {
    case "read_file":
      return "read";
    case "write_file":
      return "write";
    case "edit_file":
      return "edit";
    case "list_dir":
      return "list";
    default:
      return tool;
  }
}
