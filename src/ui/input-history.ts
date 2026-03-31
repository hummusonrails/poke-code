export class InputHistory {
  private entries: string[] = [];
  private cursor = -1;
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  push(entry: string): void {
    const trimmed = entry.trim();
    if (!trimmed) return;
    if (this.entries.length > 0 && this.entries[this.entries.length - 1] === trimmed) {
      this.cursor = -1;
      return;
    }
    this.entries.push(trimmed);
    if (this.entries.length > this.maxSize) {
      this.entries.shift();
    }
    this.cursor = -1;
  }

  up(): string {
    if (this.entries.length === 0) return "";
    if (this.cursor === -1) {
      this.cursor = this.entries.length - 1;
    } else if (this.cursor > 0) {
      this.cursor--;
    }
    return this.entries[this.cursor] ?? "";
  }

  down(): string {
    if (this.cursor === -1) return "";
    if (this.cursor < this.entries.length - 1) {
      this.cursor++;
      return this.entries[this.cursor] ?? "";
    }
    this.cursor = -1;
    return "";
  }

  search(prefix: string): string[] {
    return this.entries.filter((e) => e.startsWith(prefix)).reverse();
  }

  size(): number {
    return this.entries.length;
  }

  reset(): void {
    this.cursor = -1;
  }
}
