import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CronExpressionParser } from "cron-parser";
import { Box, render, Text, useInput } from "ink";
import { useCallback, useEffect, useRef, useState } from "react";
import { PokeApiClient } from "./api/client.js";
import { conversationLoop, createPollFn } from "./api/conversation.js";
import { getCommandList, routeCommand } from "./commands/router.js";
import { ConfigStore } from "./config/store.js";
import { ContextBuilder } from "./context/builder.js";
import { installLaunchd, uninstallLaunchd } from "./cron/launchd.js";
import { parseNaturalSchedule } from "./cron/natural-schedule.js";
import { CronScheduler } from "./cron/scheduler.js";
import { CronStorage } from "./cron/storage.js";
import { canImsgSend, imsgSend } from "./db/imsg-sender.js";
import { ChatDbPoller } from "./db/poller.js";
import { stripCommands } from "./parser/strip-commands.js";
import { AutoDream } from "./services/autodream.js";
import { SessionManager } from "./session/manager.js";
import { StartupProfiler } from "./startup.js";
import { ToolExecutor } from "./tools/executor.js";
import { ToolRegistry } from "./tools/registry.js";
import type { PermissionMode, ToolCall, ToolResult } from "./types.js";
import { formatErrorWithHint } from "./ui/error-display.js";
import { InputHistory } from "./ui/input-history.js";
import { MessageView } from "./ui/message.js";
import { PermissionPrompt } from "./ui/permission.js";
import { Spinner } from "./ui/spinner.js";
import { StatusLine } from "./ui/status-line.js";
import { matchCommands } from "./ui/typeahead.js";
import { computeAppHeight, useTerminalSize } from "./ui/use-terminal-size.js";
import { Welcome } from "./ui/welcome.js";
import { CompanionSprite, companionReservedColumns } from "./companion/CompanionSprite.js";
import { getCompanion, hatchCompanion, updateCompanionXP, setCompanionMuted, renameCompanion } from "./companion/companion.js";
import { extractEmotes } from "./companion/emote-parser.js";
import { companionEvents } from "./companion/local-events.js";
import { getNextMilestone } from "./companion/xp.js";
import type { AnimationState } from "./companion/types.js";

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
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(initialPermissionMode);
  const [verboseMode, setVerboseMode] = useState(verbose ?? false);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [messageCount, setMessageCount] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [recentSessions, setRecentSessions] = useState<{ id: string; lastActiveAt: string; cwd: string }[]>([]);
  const [companionReaction, setCompanionReaction] = useState<{ speech?: string; animation: AnimationState } | undefined>(undefined);
  const termSize = useTerminalSize();
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
  const inputHistory = useRef(new InputHistory());
  const cronScheduler = useRef<CronScheduler | null>(null);
  const cronStorage = useRef(new CronStorage(join(configDir, "scheduled_tasks.json")));
  const store = useRef(new ConfigStore(configDir));

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

  // Subscribe to companion local events → update reaction state
  useEffect(() => {
    const unsubscribe = companionEvents.on((animation, duration) => {
      setCompanionReaction({ animation });
      if (duration) {
        setTimeout(() => setCompanionReaction(undefined), duration);
      }
    });
    return unsubscribe;
  }, []);

  // Emit session_start and grant XP on mount
  useEffect(() => {
    companionEvents.emit("session_start");
    updateCompanionXP(5); // session_start XP
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize session + load recent sessions for welcome
  useEffect(() => {
    const profiler = new StartupProfiler();
    profiler.checkpoint("session-init");

    const recent = sessionManager.current.list();
    setRecentSessions(recent.map((s) => ({ id: s.id, lastActiveAt: s.lastActiveAt, cwd: s.cwd })));

    let session: ReturnType<typeof sessionManager.current.getSession> | undefined;
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

    // Start cron scheduler in session mode
    const scheduler = new CronScheduler({
      tasksPath: join(configDir, "scheduled_tasks.json"),
      resultsDir: join(configDir, "cron-results"),
      executePrompt: async (prompt: string, promptCwd: string) => {
        const builder = new ContextBuilder(new ToolRegistry(), promptCwd, configDir);
        const fullMessage = builder.build(prompt);
        const response = await apiClient.current.sendMessage(fullMessage);
        return response.message ?? "Message sent.";
      },
      onResult: (_taskId: string, prompt: string, result: string) => {
        setMessages((prev) => [...prev, { role: "system", content: `[Cron] ${prompt}\n\n${result}` }]);
      },
    });
    scheduler.start();
    cronScheduler.current = scheduler;

    profiler.checkpoint("session-ready");
    if (props.verbose) {
      console.error(`Startup:\n${profiler.summary()}`);
    }

    return () => {
      cronScheduler.current?.stop();
    };
  }, [resumeSessionId, cwd, props.verbose, configDir]); // eslint-disable-line react-hooks/exhaustive-deps

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
      inputHistory.current.push(trimmed);

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
          quit: () => {
            // Trigger autodream on quit if thresholds are met
            const dream = new AutoDream({
              sessionsDir: join(configDir, "sessions"),
              memoryDir: join(cwd, ".poke", "memory", "autodream"),
              statePath: join(configDir, "consolidation-state.json"),
              lockPath: join(configDir, "consolidation.lock"),
              config: store.current.load().autoDream,
              consolidate: async (transcript: string) => {
                const consolidationPrompt = `You are a memory consolidation agent. Read the following session transcripts and extract key facts, decisions, user preferences, and recurring patterns worth remembering for future sessions. Write concise markdown files. Format your response as fenced code blocks with the filename as the language identifier.\n\nTranscripts:\n${transcript.slice(0, 50000)}`;
                try {
                  const response = await apiClient.current.sendMessage(consolidationPrompt);
                  const text = response.message ?? "";
                  const files: { filename: string; content: string }[] = [];
                  const blockPattern = /```(\S+\.md)\n([\s\S]*?)```/g;
                  let blockMatch = blockPattern.exec(text);
                  while (blockMatch !== null) {
                    files.push({ filename: blockMatch[1], content: blockMatch[2].trim() });
                    blockMatch = blockPattern.exec(text);
                  }
                  if (files.length === 0 && text.trim()) {
                    files.push({ filename: "consolidated.md", content: text.trim() });
                  }
                  return files;
                } catch {
                  return [];
                }
              },
            });
            void (async () => {
              cronScheduler.current?.stop();
              if (dream.shouldRun()) {
                try {
                  await dream.run();
                } catch {
                  /* ignore */
                }
              }
              process.exit(0);
            })();
          },
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
          getReducedMotion: () => reducedMotion,
          setReducedMotion: (on: boolean) => setReducedMotion(on),
          cronAdd: async (scheduleOrNatural: string, prompt: string) => {
            let schedule: string;
            let actualPrompt: string;
            let oneShot = false;

            if (prompt) {
              schedule = scheduleOrNatural;
              actualPrompt = prompt.replace(" [oneshot]", "");
              oneShot = prompt.endsWith("[oneshot]");
            } else {
              // Natural language: try to split schedule from prompt
              const patterns = [
                /^(every\s+\d+\s+(?:minute|hour)s?)\s+(.+)$/i,
                /^(every\s+(?:day|weekday|hour|minute)\s+at\s+\S+)\s+(.+)$/i,
                /^(every\s+(?:day|weekday|hour|minute))\s+(.+)$/i,
                /^(every\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\S+)?)\s+(.+)$/i,
                /^((?:at|once\s+at)\s+\S+)\s+(.+)$/i,
                /^(in\s+\d+\s+(?:hour|minute)s?)\s+(.+)$/i,
              ];
              for (const pattern of patterns) {
                const match = scheduleOrNatural.match(pattern);
                if (match) {
                  const nlParsed = parseNaturalSchedule(match[1]);
                  if (nlParsed) {
                    schedule = nlParsed.cron;
                    actualPrompt = match[2];
                    oneShot = nlParsed.oneShot;
                    const next = CronExpressionParser.parse(schedule).next().toDate();
                    const task = cronStorage.current.add(actualPrompt, schedule, cwd, { oneShot });
                    return `Task ${task.id} created.\nSchedule: ${schedule}${oneShot ? " (one-shot)" : ""}\nNext run: ${next?.toLocaleString()}\nPrompt: ${actualPrompt}`;
                  }
                }
              }
              return `Could not parse schedule. Use cron syntax:\n  /cron add */30 * * * * check build status\n\nOr natural language:\n  /cron every 30 minutes check build status`;
            }

            try {
              const next = CronExpressionParser.parse(schedule).next().toDate();
              const task = cronStorage.current.add(actualPrompt, schedule, cwd, { oneShot });
              return `Task ${task.id} created.\nSchedule: ${schedule}${oneShot ? " (one-shot)" : ""}\nNext run: ${next?.toLocaleString()}\nPrompt: ${actualPrompt}`;
            } catch (err) {
              return err instanceof Error ? err.message : String(err);
            }
          },
          cronList: () => {
            const tasks = cronStorage.current.list();
            if (tasks.length === 0) return "No scheduled tasks.";
            return tasks
              .map((t) => {
                const next = (() => {
                  try {
                    return CronExpressionParser.parse(t.schedule).next().toDate()?.toLocaleString() ?? "?";
                  } catch {
                    return "?";
                  }
                })();
                return `  ${t.id}  ${t.schedule.padEnd(15)} ${t.oneShot ? "(once) " : ""}runs: ${t.runCount}  next: ${next}\n         ${t.prompt.slice(0, 60)}`;
              })
              .join("\n\n");
          },
          cronRemove: (id: string) => {
            return cronStorage.current.remove(id) ? `Removed task ${id}.` : `Task ${id} not found.`;
          },
          cronResults: (id?: string) => {
            const resultsDir = join(configDir, "cron-results");
            try {
              const files = readdirSync(resultsDir)
                .filter((f: string) => !id || f.startsWith(id))
                .sort()
                .slice(-10);
              if (files.length === 0) return "No results yet.";
              return files
                .map((f: string) => {
                  const content = readFileSync(join(resultsDir, f), "utf-8");
                  return `--- ${f} ---\n${content.slice(0, 2000)}`;
                })
                .join("\n\n");
            } catch {
              return "No results yet.";
            }
          },
          cronInstall: () => {
            const binPath = process.argv[1];
            const logPath = join(configDir, "daemon.log");
            return installLaunchd(binPath, logPath);
          },
          cronUninstall: () => {
            return uninstallLaunchd();
          },
          getCompanionCard: () => {
            const companion = getCompanion();
            if (!companion) {
              return "No companion yet! Hatch one with: /companion hatch <name>";
            }
            const milestone = getNextMilestone(companion.xp);
            const milestoneStr = milestone
              ? `Next: ${milestone.name} (${milestone.type}, ${milestone.xpNeeded} XP away)`
              : "All milestones unlocked!";
            const accessories = companion.accessories.length > 0
              ? companion.accessories.join(", ")
              : "none yet";
            return [
              `Companion: ${companion.name}`,
              `  Species: ${companion.species}`,
              `  Stage:   ${companion.stage}`,
              `  XP:      ${companion.xp}`,
              `  ${milestoneStr}`,
              `  Accessories: ${accessories}`,
              `  Muted:   ${companion.muted ? "yes" : "no"}`,
            ].join("\n");
          },
          petCompanion: () => {
            const companion = getCompanion();
            if (!companion) return "No companion to pet! Hatch one with: /companion hatch <name>";
            companionEvents.emit("tool_success");
            return `You pet ${companion.name}. It wiggles happily!`;
          },
          muteCompanion: () => {
            const companion = getCompanion();
            if (!companion) return "No companion yet.";
            setCompanionMuted(true);
            return `${companion.name} is now muted. It won't appear in responses.`;
          },
          unmuteCompanion: () => {
            const companion = getCompanion();
            if (!companion) return "No companion yet.";
            setCompanionMuted(false);
            return `${companion.name} is now unmuted!`;
          },
          renameCompanion: (name: string) => {
            const companion = getCompanion();
            if (!companion) return "No companion yet.";
            const oldName = companion.name;
            renameCompanion(name);
            return `Renamed ${oldName} to ${name}.`;
          },
          hatchCompanion: (name: string) => {
            const existing = getCompanion();
            if (existing) return `You already have a companion: ${existing.name}. Use /companion to view it.`;
            const companion = hatchCompanion(name, "curious and adaptable");
            return `A wild ${companion.species} appeared! Meet ${companion.name} (${companion.eye} eyes). Stage: ${companion.stage}`;
          },
          runDream: async () => {
            const dream = new AutoDream({
              sessionsDir: join(configDir, "sessions"),
              memoryDir: join(cwd, ".poke", "memory", "autodream"),
              statePath: join(configDir, "consolidation-state.json"),
              lockPath: join(configDir, "consolidation.lock"),
              config: store.current.load().autoDream,
              consolidate: async (transcript: string) => {
                const consolidationPrompt = `You are a memory consolidation agent. Read the following session transcripts and extract key facts, decisions, user preferences, and recurring patterns worth remembering for future sessions. Write concise markdown files. Format your response as one or more fenced code blocks with the filename as the language identifier, like:\n\n\`\`\`patterns.md\ncontent here\n\`\`\`\n\nTranscripts:\n${transcript.slice(0, 50000)}`;
                const response = await apiClient.current.sendMessage(consolidationPrompt);
                const text = response.message ?? "";
                const files: { filename: string; content: string }[] = [];
                const blockPattern = /```(\S+\.md)\n([\s\S]*?)```/g;
                let blockMatch = blockPattern.exec(text);
                while (blockMatch !== null) {
                  files.push({ filename: blockMatch[1], content: blockMatch[2].trim() });
                  blockMatch = blockPattern.exec(text);
                }
                if (files.length === 0 && text.trim()) {
                  files.push({ filename: "consolidated.md", content: text.trim() });
                }
                return files;
              },
            });
            await dream.run();
            return "Memory consolidation complete.";
          },
        };

        const result = await routeCommand(trimmed, ctx);
        if (result.handled && result.output) {
          appendMessage({ role: "system", content: result.output });
        }
        return;
      }

      appendMessage({ role: "user", content: trimmed });
      updateCompanionXP(1); // message_sent XP
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
        const imsgAvailable = chatId ? await canImsgSend() : false;
        const sendResultsFn = chatId && imsgAvailable ? (text: string) => imsgSend(chatId, text) : undefined;

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
              // Extract emotes before stripping bracket commands
              const { cleanText: emoteClean, emotes } = extractEmotes(event.content);
              if (emotes.length > 0) {
                const first = emotes[0];
                setCompanionReaction({ speech: first.speech, animation: first.animation });
                setTimeout(() => setCompanionReaction(undefined), 8000);
              }

              // Strip bracket commands from displayed text
              const clean = stripCommands(emoteClean);
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
              appendMessage({
                role: "system",
                content: `  ⏳ ${event.toolCall.tool} ${event.toolCall.params.path ?? event.toolCall.params.command ?? event.toolCall.params.pattern ?? ""}`,
              });
              break;
            case "tool_result":
              pendingToolResults.push(event.result);
              setToolResults((prev) => [...prev, event.result]);
              updateCompanionXP(2); // tool_executed XP
              companionEvents.emit(event.result.error ? "tool_failure" : "tool_success");
              if (verboseMode) {
                const label = event.result.params.path ?? event.result.params.command ?? "";
                const preview = event.result.error ? `Error: ${event.result.error}` : event.result.output.slice(0, 200);
                const marker = event.result.error ? "✗" : "✓";
                appendMessage({ role: "system", content: `  ${marker} ${event.result.tool} ${label}\n    ${preview}` });
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
              appendMessage({ role: "system", content: formatErrorWithHint(event.message) });
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
        appendMessage({ role: "system", content: formatErrorWithHint(msg) });
      } finally {
        setWaiting(false);
        setPendingPermission(null);
      }
    },
    [
      messages,
      permissionMode,
      verboseMode,
      reducedMotion,
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

    if (key.upArrow && !waiting && !pendingPermission) {
      const prev = inputHistory.current.up();
      if (prev) setInput(prev);
      return;
    }
    if (key.downArrow && !waiting && !pendingPermission) {
      setInput(inputHistory.current.down());
      return;
    }

    if (key.tab && !waiting && !pendingPermission && input.startsWith("/")) {
      const matches = matchCommands(input, getCommandList());
      if (matches.length === 1) {
        setInput(`/${matches[0].name} `);
      }
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
    <Box flexDirection="column" height={computeAppHeight(termSize.rows)}>
      {/* Welcome banner (shown until first message) */}
      {showWelcome && <Welcome version="0.1.0" cwd={cwd} recentSessions={recentSessions} />}

      {/* Message list — scrolls within viewport, shrinks when permission prompt shows */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {messages.slice(pendingPermission ? -5 : undefined).map((msg, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: messages have no stable id; index is safe for a purely append-only list
          <MessageView key={`msg-${i}`} role={msg.role} content={msg.content} />
        ))}
      </Box>

      {/* ─── Footer: always visible, visually distinct ─── */}
      <Box flexDirection="column" flexShrink={0} borderStyle="round" borderColor="#4a7cc9" paddingX={1} marginTop={1}>
        {/* Permission prompt */}
        {pendingPermission && <PermissionPrompt toolCall={pendingPermission.toolCall} />}

        {/* Spinner or input line, with companion sprite beside it */}
        <Box flexDirection="row">
          <Box flexDirection="column" flexGrow={1}>
            {waiting && !pendingPermission && <Spinner reducedMotion={reducedMotion} />}
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
                {input.startsWith("/") && input.length > 0 && !input.includes(" ") && (
                  <Box marginLeft={2}>
                    <Text color="gray" dimColor>
                      {matchCommands(input, getCommandList())
                        .slice(0, 5)
                        .map((c) => `/${c.name}`)
                        .join("  ")}
                    </Text>
                  </Box>
                )}
              </Box>
            )}
          </Box>
          {(() => {
            const companion = getCompanion();
            if (companion && !companion.muted) {
              return (
                <CompanionSprite
                  companion={companion}
                  reaction={companionReaction}
                  terminalWidth={termSize.columns}
                />
              );
            }
            return null;
          })()}
        </Box>

        {/* Status line */}
        <StatusLine
          sessionId={sessionId}
          messageCount={messageCount}
          elapsed={elapsed}
          cwd={cwd}
          permissionMode={permissionMode}
          multiLine={multiLine}
          toolCount={toolResults.length}
        />
      </Box>
    </Box>
  );
}

export function renderApp(props: AppProps): void {
  render(<App {...props} />);
}
