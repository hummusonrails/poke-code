import { readFile } from 'node:fs/promises';
import { glob } from 'glob';
import { join } from 'node:path';

interface GrepParams {
  pattern: string;
  glob?: string;
  path?: string;
}

export async function grepTool(params: GrepParams): Promise<string> {
  const cwd = params.path ?? process.cwd();
  const filePattern = params.glob ?? '**/*';
  const files = await glob(filePattern, { cwd, nodir: true, dot: false });
  const regex = new RegExp(params.pattern);
  const results: string[] = [];

  for (const file of files.sort()) {
    const fullPath = join(cwd, file);
    try {
      const content = await readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          results.push(`${file}:${i + 1}: ${lines[i]}`);
        }
      }
    } catch { /* Skip unreadable files */ }
  }

  if (results.length === 0) return 'No matches found.';
  return results.join('\n');
}
