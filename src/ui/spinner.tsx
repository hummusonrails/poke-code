import { Box, Text } from "ink";
import { useEffect, useState } from "react";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const TIPS = [
  "Tip: Use /compact to free up context",
  "Tip: Ctrl+E toggles multi-line input",
  "Tip: /verbose shows full tool output",
  "Tip: /permissions trusted skips approval prompts",
  "Tip: /doctor checks your setup",
  "Tip: /copy copies the last response to clipboard",
  "Tip: Arrow keys navigate input history",
  "Tip: /memory lists saved memory files",
];

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function getThinkingTip(): string {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

interface SpinnerProps {
  label?: string;
  showDuration?: boolean;
  showTips?: boolean;
  reducedMotion?: boolean;
}

export function Spinner({
  label = "Poke is thinking...",
  showDuration = true,
  showTips = true,
  reducedMotion = false,
}: SpinnerProps) {
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [tip, setTip] = useState(() => getThinkingTip());

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => setFrame((prev) => (prev + 1) % FRAMES.length), 80);
    return () => clearInterval(timer);
  }, [reducedMotion]);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((prev) => prev + 1000), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showTips) return;
    const timer = setInterval(() => setTip(getThinkingTip()), 15000);
    return () => clearInterval(timer);
  }, [showTips]);

  const spinnerChar = reducedMotion ? "…" : FRAMES[frame];

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="#f5a623">
          {spinnerChar} {label}
        </Text>
        {showDuration && elapsed >= 2000 && <Text color="gray"> ({formatDuration(elapsed)})</Text>}
      </Box>
      {showTips && elapsed >= 5000 && (
        <Text color="gray" dimColor>
          {"  "}
          {tip}
        </Text>
      )}
    </Box>
  );
}
