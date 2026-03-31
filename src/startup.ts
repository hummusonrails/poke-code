export interface Timing {
  label: string;
  elapsed: number;
  timestamp: number;
}

export class StartupProfiler {
  private start: number;
  private timings: Timing[] = [];

  constructor() {
    this.start = performance.now();
  }

  checkpoint(label: string): void {
    this.timings.push({
      label,
      elapsed: performance.now() - this.start,
      timestamp: Date.now(),
    });
  }

  getTimings(): Timing[] {
    return [...this.timings];
  }

  summary(): string {
    return this.timings
      .map((t, i) => {
        const delta = i === 0 ? t.elapsed : t.elapsed - this.timings[i - 1].elapsed;
        return `  ${t.label}: +${delta.toFixed(1)}ms (${t.elapsed.toFixed(1)}ms total)`;
      })
      .join("\n");
  }
}

export async function parallelStartup<T extends Record<string, () => Promise<unknown>>>(
  tasks: T,
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> | null }> {
  const entries = Object.entries(tasks);
  const results = await Promise.allSettled(entries.map(([, fn]) => fn()));
  const out: Record<string, unknown> = {};
  for (let i = 0; i < entries.length; i++) {
    const [key] = entries[i];
    const result = results[i];
    out[key] = result.status === "fulfilled" ? result.value : null;
  }
  return out as { [K in keyof T]: Awaited<ReturnType<T[K]>> | null };
}
