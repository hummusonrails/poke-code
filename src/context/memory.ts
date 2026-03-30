import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export class MemoryReader {
  private memoryDir: string;
  constructor(memoryDir: string) { this.memoryDir = memoryDir; }

  read(): string {
    if (!existsSync(this.memoryDir)) return '';
    const indexPath = join(this.memoryDir, 'MEMORY.md');
    if (!existsSync(indexPath)) return '';
    const index = readFileSync(indexPath, 'utf-8');
    const parts = [index];
    const files = readdirSync(this.memoryDir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md');
    for (const file of files) {
      try { parts.push(`\n### ${file}\n${readFileSync(join(this.memoryDir, file), 'utf-8')}`); } catch {}
    }
    return parts.join('\n');
  }
}
