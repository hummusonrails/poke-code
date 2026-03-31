import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { Chalk } from "chalk";
import { highlight } from "cli-highlight";

interface ReadFileParams {
  path: string;
  limit?: number;
  offset?: number;
}

// extension to language map for syntax highlighting
const EXT_TO_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".py": "python",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".css": "css",
  ".scss": "scss",
  ".html": "html",
  ".htm": "html",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "ini",
  ".xml": "xml",
  ".sql": "sql",
  ".rs": "rust",
  ".go": "go",
  ".rb": "ruby",
  ".swift": "swift",
  ".kt": "kotlin",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
};

// force colors on so highlighting works outside tty
const chalk = new Chalk({ level: 3 });

const FORCED_THEME = {
  keyword: chalk.blue,
  built_in: chalk.cyan,
  type: chalk.cyan,
  literal: chalk.blue,
  number: chalk.green,
  regexp: chalk.red,
  string: chalk.red,
  comment: chalk.green,
  doctag: chalk.green,
  meta: chalk.grey,
  tag: chalk.grey,
  name: chalk.blue,
  attr: chalk.cyan,
  emphasis: chalk.italic,
  strong: chalk.bold,
  link: chalk.underline,
  addition: chalk.green,
  deletion: chalk.red,
  default: (s: string) => s,
};

function highlightCode(content: string, filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const lang = EXT_TO_LANG[ext];
  if (!lang) return content; // no highlighting for unknown extensions

  try {
    return highlight(content, { language: lang, ignoreIllegals: true, theme: FORCED_THEME });
  } catch {
    return content; // fallback to plain text
  }
}

export async function readFileTool(params: ReadFileParams): Promise<string> {
  const content = await readFile(params.path, "utf-8");
  const lines = content.split("\n");
  const start = (params.offset ?? 1) - 1;
  const end = params.limit ? start + params.limit : lines.length;
  const selectedLines = lines.slice(start, end);

  const highlighted = highlightCode(selectedLines.join("\n"), params.path);
  const highlightedLines = highlighted.split("\n");

  return highlightedLines.map((line, i) => `${start + i + 1}\t${line}`).join("\n");
}
