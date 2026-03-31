import { useEffect, useState } from "react";

export interface TerminalSize {
  columns: number;
  rows: number;
}

export function getTerminalSize(): TerminalSize {
  return {
    columns: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24,
  };
}

export function clampHeight(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const MIN_ROWS = 10;

export function useTerminalSize(): TerminalSize {
  const [size, setSize] = useState<TerminalSize>(getTerminalSize);

  useEffect(() => {
    const handler = () => setSize(getTerminalSize());
    process.stdout.on("resize", handler);
    return () => {
      process.stdout.off("resize", handler);
    };
  }, []);

  return size;
}

export function computeAppHeight(rows: number): number {
  return clampHeight(Math.floor(rows * 0.85), MIN_ROWS, rows - 2);
}
