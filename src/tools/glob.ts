import { glob as globFn } from "glob";

interface GlobParams {
  pattern: string;
  path?: string;
}

export async function globTool(params: GlobParams): Promise<string> {
  const cwd = params.path ?? process.cwd();
  const matches = await globFn(params.pattern, { cwd, nodir: true, dot: false });
  if (matches.length === 0) return "No files matched the pattern.";
  return matches.sort().join("\n");
}
