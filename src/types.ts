export type PermissionMode = "default" | "trusted" | "readonly";

export type ToolPermission = "auto" | "ask" | "deny";

export interface ToolDefinition {
  name: string;
  description: string;
  params: Record<string, { type: string; required: boolean; description: string }>;
  permission: ToolPermission;
}

export interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
}

export interface ToolResult {
  tool: string;
  params: Record<string, unknown>;
  output: string;
  error?: string;
}

export interface ParsedResponse {
  textSegments: string[];
  toolCalls: ToolCall[];
}

export interface Message {
  rowId: number;
  text: string;
  isFromMe: boolean;
  date: Date;
  hasAttachments: boolean;
}

export interface SessionEntry {
  role: "user" | "assistant" | "tool";
  content?: string;
  toolCalls?: ToolCall[];
  results?: ToolResult[];
  timestamp: string;
}

export interface SessionMeta {
  id: string;
  startedAt: string;
  lastActiveAt: string;
  messageCount: number;
  cwd: string;
  label?: string;
}

export interface PokeConfig {
  apiKey?: string;
  handleId?: number;
  chatId?: number;
  handleIdentifier?: string;
  permissionMode: PermissionMode;
  vimMode: boolean;
  theme: string;
  pollIntervalNormal: number;
  pollIntervalFast: number;
  fastPollDuration: number;
}

export const DEFAULT_CONFIG: PokeConfig = {
  permissionMode: "default",
  vimMode: false,
  theme: "default",
  pollIntervalNormal: 3000,
  pollIntervalFast: 1500,
  fastPollDuration: 30000,
};

export interface HandleInfo {
  rowId: number;
  identifier: string;
  chatId: number;
}

export type OutputFormat = "text" | "json" | "stream-json";

export type ConversationEvent =
  | { type: "text"; content: string }
  | { type: "tool_use"; toolCall: ToolCall }
  | { type: "tool_result"; result: ToolResult }
  | { type: "sending_results"; count: number }
  | { type: "error"; message: string }
  | { type: "done" };

export type ToolEvent = { type: "progress"; tool: string; message: string } | { type: "result"; result: ToolResult };

export interface CliArgs {
  _: (string | number)[];
  init?: boolean;
  resume?: string;
  continue?: boolean;
  permissionMode?: PermissionMode;
  systemPrompt?: string;
  outputFormat?: OutputFormat;
  addDir?: string[];
  verbose?: boolean;
  noTools?: boolean;
  p?: boolean;
}
