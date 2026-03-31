import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Box, render, Text, useInput } from "ink";
import { useCallback, useEffect, useRef, useState } from "react";
import { PokeApiClient } from "./api/client.js";
import { conversationLoop, createPollFn } from "./api/conversation.js";
import { routeCommand } from "./commands/router.js";
import { ConfigStore } from "./config/store.js";
import { ContextBuilder } from "./context/builder.js";
import { imsgSend } from "./db/imsg-sender.js";
import { ChatDbPoller } from "./db/poller.js";
import { stripCommands } from "./parser/strip-commands.js";
import { SessionManager } from "./session/manager.js";
import { ToolExecutor } from "./tools/executor.js";
import { ToolRegistry } from "./tools/registry.js";
import type { PermissionMode, ToolCall, ToolResult } from "./types.js";
import { MessageView } from "./ui/message.js";
import { PermissionPrompt } from "./ui/permission.js";
import { Spinner } from "./ui/spinner.js";
import { StatusLine } from "./ui/status-line.js";
import { StartupProfiler } from "./startup.js";
import { Welcome } from "./ui/welcome.js";

export interface AppProps {
  apiKey: string;
  configDir: string;
  cwd: string;
  chatId?: number;
  handleId?: number;
  dbPath: string;
  permissionMode: PermissionMode;
  verbose?: boolean;
  noTools?: boolean;
  systemPrompt?: string;
  resumeSessionId?: string;
}

interface UiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface PendingPermission {
  toolCall: ToolCall;
  resolve: (approved: boolean) => void;
}

function formatElapsed(startTime: Date): string {
  const ms = Date.now() - startTime.getTime();
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m${s % 60}s`;
  return `${s}s`;
}

function App(props: AppProps) {
  const {
    apiKey,
    configDir,
    cwd,
    chatId,
    handleId,
    dbPath,
    permissionMode: initialPermissionMode,
    verbose,
    noTools,
    systemPrompt,
    resumeSessionId,
  } = props;

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [multiLine, setMultiLine] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [_toolResults, setToolResults] = useState<ToolResult[]>([]);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(initialPermissionMode);
  const [verboseMode, setVerboseMode] = useState(verbose ?? false);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [messageCount, setMessageCount] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [recentSessions, setRecentSessions] = useState<{ id: string; lastActiveAt: string; cwd: string }[]>([]);
  const startTime = useRef(new Date());
  const [elapsed, setElapsed] = useState("0s");

  // Core service instances (created once)
  const apiClient = useRef(new PokeApiClient(apiKey));
  const registry = useRef(new ToolRegistry());
  const contextBuilder = useRef(new ContextBuilder(registry.current, cwd, configDir));
  const sessionManager = useRef(new SessionManager(`${configDir}/sessions`));
  const pollerRef = useRef<ChatDbPoller | null>(null);
  const lastSeenRowId = useRef<number>(0);
  const alwaysAllowed = useRef<Set<string>>(new Set());

  // Permission prompt function for ToolExecutor
  const promptForPermission = useCallback((toolCall: ToolCall): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPendingPermission({ toolCall, resolve });
    });
  }, []);

  const executor = useRef(new ToolExecutor(registry.current, permissionMode, promptForPermission));

  // Keep executor mode in sync
  useEffect(() => {
    executor.current.setMode(permissionMode);
  }, [permissionMode]);

  // Update elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(formatElapsed(startTime.current)), 1000);
    return () => clearInterval(t);
  }, []);

  // Initialize session + load recent sessions for welcome
  useEffect(() => {
    const profiler = new StartupProfiler();
    profiler.checkpoint('session-init');

    const recent = sessionManager.current.list();
    setRecentSessions(recent.map((s) => ({ id: s.id, lastActiveAt: s.lastActiveAt, cwd: s.cwd })));

    let session;
    if (resumeSessionId) {
      session = sessionManager.current.getSession(resumeSessionId);
      if (session) {
        const entries = sessionManager.current.loadEntries(resumeSessionId);
        const loaded: UiMessage[] = [];
        for (const entry of entries) {
          if (entry.role === "user" && entry.content) {
            loaded.push({ role: "user", content: entry.content });
          } else if (entry.role === "assistant" && entry.content) {
            loaded.push({ role: "assistant", content: entry.content });
          }
        }
        setMessages(loaded);
        setMessageCount(entries.length);
        setShowWelcome(false);
      }
    }
    if (!session) {
      session = sessionManager.current.create(cwd);
    }
    setSessionId(session.id);

    profiler.checkpoint('session-ready');
    if (props.verbose) {
      console.error(`Startup:\n${profiler.summary()}`);
    }
  }, [resumeSessionId, cwd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set up chat.db poller for receiving messages
  useEffect(() => {
    if (!chatId || !handleId) return;
    try {
      const poller = new ChatDbPoller(dbPath, {});
      poller.setHandle(handleId, chatId);
      const initial = poller.loadInitialMessages();
      if (initial.length > 0) {
        lastSeenRowId.current = initial[initial.length - 1].rowId;
      }
      pollerRef.current = poller;
      return () => {
        poller.close();
      };
    } catch {
      // DB not accessible
    }
  }, [chatId, handleId, dbPath]);

  const appendMessage = useCallback((msg: UiMessage) => {
    setMessages((prev) => [...prev, msg]);
    setMessageCount((prev) => prev + 1);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Hide welcome on first message
      if (showWelcome) setShowWelcome(false);

      // Check slash commands
      if (trimmed.startsWith("/")) {
        const ctx = {
          clearScreen: () => setMessages([]),
          getHistory: () => messages.map((m) => `${m.role}: ${m.content}`),
          listSessions: () =>
            sessionManager.current
              .list()
              .map((s) => `${s.id.slice(0, 8)} ${s.lastActiveAt} ${s.cwd}`)
              .join("\n") || "No sessions.",
          resumeSession: (id: string) => {
            const entries = sessionManager.current.loadEntries(id);
            const loaded: UiMessage[] = [];
            for (const entry of entries) {
              if (entry.role === "user" && entry.content) loaded.push({ role: "user", content: entry.content });
              else if (entry.role === "assistant" && entry.content)
                loaded.push({ role: "assistant", content: entry.content });
            }
            setMessages(loaded);
          },
          getPermissionMode: () => permissionMode,
          setPermissionMode: (mode: string) => {
            if (mode === "default" || mode === "trusted" || mode === "readonly") {
              setPermissionMode(mode as PermissionMode);
            }
          },
          getStatus: () =>
            `API: connected  chatId: ${chatId ?? "not configured"}  handleId: ${handleId ?? "not configured"}`,
          getConfig: () => `configDir: ${configDir}  cwd: ${cwd}  permissionMode: ${permissionMode}`,
          toggleVerbose: () => {
            const next = !verboseMode;
            setVerboseMode(next);
            return next;
          },
          getVerbose: () => verboseMode,
          compact: async () => {
            const { compactHistory } = await import("./session/compactor.js");
            const entries = sessionManager.current.loadEntries(sessionId);
            const summary = compactHistory(entries);
            setMessages([{ role: "system", content: `Context compacted. Summary: ${summary}` }]);
          },
          setApiKey: (key: string) => {
            const store = new ConfigStore(configDir);
            store.update({ apiKey: key });
            apiClient.current = new PokeApiClient(key);
          },
          quit: () => process.exit(0),
          getMemoryList: () => {
            const dirs = [join(cwd, ".poke/memory"), join(cwd, ".claude/memory"), join(configDir, "memory")];
            const files: string[] = [];
            for (const dir of dirs) {
              if (!existsSync(dir)) continue;
              for (const f of readdirSync(dir).filter((f: string) => f.endsWith(".md"))) {
                const content = readFileSync(join(dir, f), "utf-8");
                const firstLine = content.split("\n").find((l: string) => l.trim() && !l.startsWith("---")) ?? "";
                files.push(`  ${f} — ${firstLine.trim().slice(0, 60)}`);
              }
            }
            return files.length > 0 ? `Memory files:\n${files.join("\n")}` : "No memory files found.";
          },
          getMemoryContent: (name: string) => {
            const dirs = [join(cwd, ".poke/memory"), join(cwd, ".claude/memory"), join(configDir, "memory")];
            for (const dir of dirs) {
              const p = join(dir, name.endsWith(".md") ? name : `${name}.md`);
              if (existsSync(p)) return readFileSync(p, "utf-8");
            }
            return `Memory file "${name}" not found.`;
          },
          runDiagnostics: async () => {
            const checks: string[] = [];

            // API key
            const apiKey = new ConfigStore(configDir).resolveApiKey();
            checks.push(apiKey ? "✓ API key configured" : "✗ API key not set — run poke-code --init");

            // chat.db
            const dbExists = existsSync(join(homedir(), "Library/Messages/chat.db"));
            checks.push(dbExists ? "✓ chat.db accessible" : "✗ chat.db not found — grant Full Disk Access to terminal");

            // chatId/handleId
            const config = new ConfigStore(configDir).load();
            checks.push(
              config.chatId ? `✓ chatId: ${config.chatId}` : "✗ chatId not configured — run poke-code --init",
            );
            checks.push(config.handleId ? `✓ handleId: ${config.handleId}` : "⚠ handleId not configured");

            // imsg
            try {
              execFileSync("imsg", ["--version"], { timeout: 3000 });
              checks.push("✓ imsg CLI installed");
            } catch {
              checks.push("⚠ imsg not installed (optional — install: brew install steipete/tap/imsg)");
            }

            // Node version
            const nodeVersion = process.version;
            const major = parseInt(nodeVersion.slice(1), 10);
            checks.push(major >= 20 ? `✓ Node.js ${nodeVersion}` : `⚠ Node.js ${nodeVersion} — recommended ≥ 20`);

            // Project context
            const hasPoke = existsSync(join(cwd, "POKE.md"));
            const hasClaude = existsSync(join(cwd, "CLAUDE.md"));
            checks.push(
              hasPoke || hasClaude
                ? `✓ Project context: ${hasPoke ? "POKE.md" : "CLAUDE.md"}`
                : "⚠ No POKE.md or CLAUDE.md in project",
            );

            // Skills
            const skillCount = contextBuilder.current.listSkills().length;
            checks.push(`✓ ${skillCount} skills discovered`);

            // Config file
            checks.push(existsSync(join(configDir, "config.json")) ? "✓ Config file exists" : "⚠ No config file");

            return `Diagnostics:\n${checks.join("\n")}`;
          },
          copyLastMessage: () => {
            const lastAssistant = messages
              .slice()
              .reverse()
              .find((m: UiMessage) => m.role === "assistant");
            if (!lastAssistant) return "No assistant message to copy.";
            try {
              const { execSync } = require("node:child_process");
              execSync("pbcopy", { input: lastAssistant.content, timeout: 3000 });
              return "Copied last response to clipboard.";
            } catch {
              return "Failed to copy to clipboard.";
            }
          },
        };

        const result = await routeCommand(trimmed, ctx);
        if (result.handled && result.output) {
          appendMessage({ role: "system", content: result.output });
        }
        return;
      }

      appendMessage({ role: "user", content: trimmed });
      if (sessionId) {
        sessionManager.current.append(sessionId, {
          role: "user",
          content: trimmed,
          timestamp: new Date().toISOString(),
        });
      }

      setWaiting(true);
      setToolResults([]);

      try {
        // Build pollFn from chat.db poller
        if (!pollerRef.current) {
          const fullMessage = contextBuilder.current.build(trimmed, systemPrompt);
          await apiClient.current.sendMessage(fullMessage);
          appendMessage({
            role: "system",
            content: "Message sent. (Set chatId/handleId in ~/.poke/config.json to receive responses)",
          });
          setWaiting(false);
          return;
        }

        const pollFn = createPollFn(pollerRef.current, lastSeenRowId.current, {
          onRowIdAdvance: (rowId) => {
            lastSeenRowId.current = rowId;
          },
        });

        // Use imsg send for tool results when available (bypasses Poke API, more reliable for large payloads)
        const sendResultsFn = chatId ? (text: string) => imsgSend(chatId, text) : undefined;

        const events = conversationLoop(trimmed, {
          apiClient: apiClient.current,
          executor: executor.current,
          contextBuilder: contextBuilder.current,
          cwd,
          systemPrompt,
          noTools,
          pollFn,
          sendResultsFn,
        });

        let pendingToolResults: ToolResult[] = [];

        for await (const event of events) {
          switch (event.type) {
            case "text": {
              // Strip bracket commands from displayed text
              const clean = stripCommands(event.content);
              if (clean) {
                appendMessage({ role: "assistant", content: clean });
              }
              if (sessionId) {
                sessionManager.current.append(sessionId, {
                  role: "assistant",
                  content: event.content,
                  timestamp: new Date().toISOString(),
                });
              }
              break;
            }
            case "tool_use":
              // Don't show per-tool messages — wait for batch summary
              break;
            case "tool_result":
              pendingToolResults.push(event.result);
              setToolResults((prev) => [...prev, event.result]);
              if (verboseMode) {
                const label = event.result.params.path ?? event.result.params.command ?? "";
                const preview = event.result.error ? `Error: ${event.result.error}` : event.result.output.slice(0, 200);
                appendMessage({ role: "system", content: `  ◆ ${event.result.tool} ${label}\n    ${preview}` });
              }
              if (sessionId) {
                sessionManager.current.append(sessionId, {
                  role: "tool",
                  toolCalls: [{ tool: event.result.tool, params: event.result.params }],
                  results: [event.result],
                  timestamp: new Date().toISOString(),
                });
              }
              break;
            case "sending_results":
              appendMessage({
                role: "system",
                content: `  ↑ sending ${event.count} result${event.count > 1 ? "s" : ""} to Poke...`,
              });
              break;
            case "error":
              appendMessage({ role: "system", content: `Error: ${event.message}` });
              break;
            case "done":
              break;
          }

          // When we transition from tool_result to a non-tool event, flush the summary
          if (event.type !== "tool_result" && pendingToolResults.length > 0) {
            const counts = new Map<string, number>();
            for (const r of pendingToolResults) {
              const short =
                r.tool === "read_file"
                  ? "read"
                  : r.tool === "list_dir"
                    ? "list"
                    : r.tool === "write_file"
                      ? "write"
                      : r.tool === "edit_file"
                        ? "edit"
                        : r.tool;
              counts.set(short, (counts.get(short) ?? 0) + 1);
            }
            const errors = pendingToolResults.filter((r) => r.error).length;
            const parts = Array.from(counts.entries()).map(([t, c]) => (c > 1 ? `${c} ${t}` : t));
            let summary = `  ◆ ${parts.join(", ")}`;
            if (errors > 0) summary += ` (${errors} failed)`;
            appendMessage({ role: "system", content: summary });
            pendingToolResults = [];
          }
        }

        // Flush any remaining tool results at the end
        if (pendingToolResults.length > 0) {
          const counts = new Map<string, number>();
          for (const r of pendingToolResults) {
            const short =
              r.tool === "read_file"
                ? "read"
                : r.tool === "list_dir"
                  ? "list"
                  : r.tool === "write_file"
                    ? "write"
                    : r.tool === "edit_file"
                      ? "edit"
                      : r.tool;
            counts.set(short, (counts.get(short) ?? 0) + 1);
          }
          const errors = pendingToolResults.filter((r) => r.error).length;
          const parts = Array.from(counts.entries()).map(([t, c]) => (c > 1 ? `${c} ${t}` : t));
          let summary = `  ◆ ${parts.join(", ")}`;
          if (errors > 0) summary += ` (${errors} failed)`;
          appendMessage({ role: "system", content: summary });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        appendMessage({ role: "system", content: `Error: ${msg}` });
      } finally {
        setWaiting(false);
        setPendingPermission(null);
      }
    },
    [
      messages,
      permissionMode,
      verboseMode,
      chatId,
      handleId,
      sessionId,
      noTools,
      systemPrompt,
      showWelcome,
      appendMessage,
      configDir,
      cwd,
    ],
  );

  useInput((ch, key) => {
    // Handle pending permission prompt
    if (pendingPermission) {
      if (ch === "y" || ch === "Y") {
        pendingPermission.resolve(true);
        setPendingPermission(null);
      } else if (ch === "n" || ch === "N") {
        pendingPermission.resolve(false);
        setPendingPermission(null);
      } else if (ch === "a" || ch === "A") {
        alwaysAllowed.current.add(pendingPermission.toolCall.tool);
        pendingPermission.resolve(true);
        setPendingPermission(null);
      }
      return;
    }

    if (key.return) {
      if (multiLine) {
        setInput((prev) => `${prev}\n`);
      } else {
        const toSend = input;
        setInput("");
        void handleSend(toSend);
      }
      return;
    }

    // Ctrl+D in multi-line mode: submit
    if (key.ctrl && ch === "d" && multiLine) {
      const toSend = input;
      setInput("");
      setMultiLine(false);
      void handleSend(toSend);
      return;
    }

    // Ctrl+E: toggle multi-line mode
    if (key.ctrl && ch === "e") {
      setMultiLine((prev) => !prev);
      return;
    }

    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    if (key.ctrl && ch === "c") {
      process.exit(0);
    }

    if (ch && !key.ctrl && !key.meta) {
      setInput((prev) => prev + ch);
    }
  });

  return (
    <Box flexDirection="column" height={Math.floor((process.stdout.rows ?? 24) * 0.8)}>
      {/* Welcome banner (shown until first message) */}
      {showWelcome && <Welcome version="0.1.0" cwd={cwd} recentSessions={recentSessions} />}

      {/* Message list — scrolls within viewport, shrinks when permission prompt shows */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {messages.slice(pendingPermission ? -5 : undefined).map((msg, i) => (
          <MessageView key={`msg-${i}`} role={msg.role} content={msg.content} />
        ))}
      </Box>

      {/* ─── Footer: always visible, visually distinct ─── */}
      <Box flexDirection="column" flexShrink={0} borderStyle="round" borderColor="#4a7cc9" paddingX={1} marginTop={1}>
        {/* Permission prompt */}
        {pendingPermission && <PermissionPrompt toolCall={pendingPermission.toolCall} />}

        {/* Spinner or input line */}
        {waiting && !pendingPermission && <Spinner />}
        {!waiting && !pendingPermission && (
          <Box flexDirection="column">
            {multiLine && (
              <Text color="#5a7a9a" dimColor>
                {" "}
                multi-line mode (Ctrl+D to send, Ctrl+E to exit)
              </Text>
            )}
            <Box>
              <Text color="#4a7cc9" bold>
                {multiLine ? "… " : "› "}
              </Text>
              <Text>{input}</Text>
              <Text color="gray">{"█"}</Text>
            </Box>
          </Box>
        )}

        {/* Status line */}
        <StatusLine
          sessionId={sessionId}
          messageCount={messageCount}
          elapsed={elapsed}
          cwd={cwd}
          permissionMode={permissionMode}
          multiLine={multiLine}
        />
      </Box>
    </Box>
  );
}

export function renderApp(props: AppProps): void {
  render(<App {...props} />);
}
