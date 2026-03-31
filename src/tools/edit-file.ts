import { readFile, writeFile } from "node:fs/promises";
import { createPatch } from "diff";

interface EditFileParams {
  path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

function buildDiffPreview(filePath: string, oldContent: string, newContent: string): string {
  const patch = createPatch(filePath, oldContent, newContent, "", "", { context: 2 });
  const changedLines = patch
    .split("\n")
    .slice(4)
    .filter((l) => l.startsWith("+") || l.startsWith("-"));
  const preview = changedLines.slice(0, 10).join("\n");
  const more = changedLines.length > 10 ? "\n... (more changes)" : "";
  return `${preview}${more}`;
}

export async function editFileTool(params: EditFileParams): Promise<string> {
  const content = await readFile(params.path, "utf-8");

  if (!content.includes(params.old_string)) {
    throw new Error(`old_string not found in ${params.path}`);
  }

  if (params.replace_all) {
    const updated = content.replaceAll(params.old_string, params.new_string);
    await writeFile(params.path, updated, "utf-8");
    const count = content.split(params.old_string).length - 1;
    const diffPreview = buildDiffPreview(params.path, content, updated);
    return `Replaced ${count} occurrence(s) in ${params.path}\n${diffPreview}`;
  }

  // Check for ambiguity
  const firstIdx = content.indexOf(params.old_string);
  const secondIdx = content.indexOf(params.old_string, firstIdx + 1);
  if (secondIdx !== -1) {
    throw new Error(
      `old_string is ambiguous in ${params.path} (found multiple occurrences). Use replace_all or provide a longer string.`,
    );
  }

  const updated = content.replace(params.old_string, params.new_string);
  await writeFile(params.path, updated, "utf-8");
  const diffPreview = buildDiffPreview(params.path, content, updated);
  return `Replaced 1 occurrence in ${params.path}\n${diffPreview}`;
}
