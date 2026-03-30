import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

interface ListDirParams {
  path: string;
}

export async function listDirTool(params: ListDirParams): Promise<string> {
  const entries = await readdir(params.path);
  const results: string[] = [];
  for (const entry of entries.sort()) {
    const fullPath = join(params.path, entry);
    const stats = await stat(fullPath);
    results.push(stats.isDirectory() ? `${entry}/` : entry);
  }
  if (results.length === 0) return '(empty directory)';
  return results.join('\n');
}
