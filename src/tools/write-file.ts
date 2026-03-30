import { writeFile, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

interface WriteFileParams {
  path: string;
  content: string;
}

export async function writeFileTool(params: WriteFileParams): Promise<string> {
  // guard against partial writes from split imessages
  try {
    const existing = await stat(params.path);
    if (existing.isFile()) {
      const oldContent = await readFile(params.path, 'utf-8');
      if (params.content.length < oldContent.length * 0.5 && oldContent.length > 100) {
        return `Refused: new content (${params.content.length} bytes) is less than half the existing file (${oldContent.length} bytes). This looks like a partial write from a split iMessage. Re-send the full content to overwrite.`;
      }
    }
  } catch {
    // file doesn't exist yet, that's fine
  }

  await mkdir(dirname(params.path), { recursive: true });
  await writeFile(params.path, params.content, 'utf-8');
  return `Written ${params.path} (${params.content.length} bytes)`;
}
