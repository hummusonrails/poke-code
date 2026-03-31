/**
 * Strip bracket commands, edit/write blocks, and tool-call XML from Poke's
 * response text, leaving only the natural language parts for display.
 *
 * This must be aggressive — iMessage splits responses across multiple bubbles,
 * so edit blocks ([old]...[/old] [new]...[/new]) often arrive fragmented.
 * We strip any line that looks like tool markup rather than natural language.
 */

/** Bracket commands: [tag] with optional target on its own line */
const BRACKET_LINE = /^\[(?:read|run|list|find|grep|search|write|edit|fetch)\](?:\s+.*)?$/gim;

/** Edit/write markup tags — these leak when split across bubbles */
const MARKUP_TAGS = /^\[(?:old|\/old|new|\/new|\/edit|\/write)\].*$/gim;

/** Write blocks: [write] path ... [/write] (when in one chunk) */
const WRITE_BLOCK = /\[write\]\s+.+\n[\s\S]*?\[\/write\]/gm;

/** Edit blocks: [edit] path + [old]...[/old] [new]...[/new] (when in one chunk) */
const EDIT_BLOCK = /\[edit\]\s+.+\n\[old\]\n[\s\S]*?\[\/old\]\n\[new\]\n[\s\S]*?\[\/new\]/gm;

/** XML tool calls: <tool_call>...</tool_call> */
const XML_TOOL_CALL = /<tool_call>[\s\S]*?<\/tool_call>/g;

/** Emote blocks: [emote]...[/emote] (companion reactions, not for display) */
const EMOTE_BLOCK = /\[emote\][\s\S]*?\[\/emote\]/gm;

/** Fenced code blocks — Poke often sends raw code as part of edit attempts */
const CODE_BLOCK = /```\w*\n[\s\S]*?```/gm;

/**
 * Lines that look like code rather than natural language.
 * Heuristic: starts with common code patterns (import, const, function, //, etc.)
 */
/**
 * Lines that look like code. Must be specific enough to avoid matching
 * natural language like "let me check" or "for real this time".
 */
const CODE_LINE =
  /^(?:import [{'\w]|export (?:default |const |function |class |interface |type )|const \w+ =|let \w+ =|var \w+ =|function \w+\(|class \w+[{ ]|interface \w+ |type \w+ =|\/\/\s|\/\*|\*\/|\* |[{}];?$|<\/\w+>|await \w|return [^a-z]|if \([^)]+\) \{|for \((?:const|let|var) |while \()/;

/** Lines that look like markdown table rows or table separators */
const TABLE_LINE = /^\|.*\|$/;
const TABLE_SEPARATOR = /^\|[-:\s|]+\|$/;

export function stripCommands(text: string): string {
  const result = text
    // Strip complete multi-line blocks first
    .replace(WRITE_BLOCK, "")
    .replace(EDIT_BLOCK, "")
    .replace(EMOTE_BLOCK, "")
    .replace(XML_TOOL_CALL, "")
    .replace(CODE_BLOCK, "")
    // Strip individual markup lines (fragmented across bubbles)
    .replace(MARKUP_TAGS, "")
    .replace(BRACKET_LINE, "");

  // Filter remaining lines — remove leaked code, tables, indented blocks
  const lines = result.split("\n");
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true; // keep blank lines
    if (CODE_LINE.test(trimmed)) return false;
    if (TABLE_LINE.test(trimmed)) return false;
    if (TABLE_SEPARATOR.test(trimmed)) return false;
    // Indented lines (4+ spaces) are likely code or structured content
    if (line.match(/^\s{4,}\S/) && !line.match(/^\s+-\s/)) return false;
    return true;
  });

  return filtered
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
