import type { ContextBuilder } from "../context/builder.js";
import type { ImsgWatcher } from "../db/imsg-watcher.js";
import type { ChatDbPoller } from "../db/poller.js";
import { parseBrackets } from "../parser/bracket-parser.js";
import { hasIncompleteBlock } from "../parser/incomplete-check.js";
import { parseIntent } from "../parser/intent-parser.js";
import { parseResponse } from "../parser/response-parser.js";
import type { ToolExecutor } from "../tools/executor.js";
import type { ConversationEvent } from "../types.js";
import type { PokeApiClient } from "./client.js";

export type PollFn = (onChunk: (text: string) => void) => Promise<string>;

export interface PollOptions {
  timeoutMs?: number;
  silenceThreshold?: number;
  pollIntervalMs?: number;
  onRowIdAdvance?: (rowId: number) => void;
}

export function createPollFn(poller: ChatDbPoller, lastSeenRowId: number, options: PollOptions = {}): PollFn {
  const { timeoutMs = 180_000, silenceThreshold = 10, pollIntervalMs = 1500 } = options;

  return (onChunk: (text: string) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      poller.clearCallbacks();

      const freshMessages = poller.loadInitialMessages();
      let capturedRowId =
        freshMessages.length > 0 ? Math.max(...freshMessages.map((m: any) => m.rowId)) : lastSeenRowId;

      let emptyPolls = 0;
      let gotFirstMessage = false;
      let extraWaits = 0;
      const collectedChunks: string[] = [];

      const timeoutId = setTimeout(() => {
        cleanup();
        if (collectedChunks.length > 0) {
          resolve(collectedChunks.join("\n"));
        } else {
          reject(new Error("Timed out waiting for response"));
        }
      }, timeoutMs);

      let pollTimer: ReturnType<typeof setTimeout> | null = null;

      function cleanup() {
        if (pollTimer) clearTimeout(pollTimer);
        clearTimeout(timeoutId);
        poller.clearCallbacks();
      }

      function doPoll() {
        const countBefore = collectedChunks.length;
        poller.pollOnce();

        if (collectedChunks.length > countBefore) {
          emptyPolls = 0;
          gotFirstMessage = true;
        } else if (gotFirstMessage) {
          emptyPolls++;
          if (emptyPolls >= silenceThreshold) {
            // Check for incomplete blocks — keep waiting if write/edit is mid-stream
            const accumulated = collectedChunks.join("\n");
            if (hasIncompleteBlock(accumulated) && extraWaits < 3) {
              extraWaits++;
              emptyPolls = 0; // reset silence counter, keep waiting
            } else {
              cleanup();
              resolve(accumulated);
              return;
            }
          }
        }

        pollTimer = setTimeout(doPoll, pollIntervalMs);
      }

      poller.onMessages((msgs: any[]) => {
        const incoming = msgs.filter((m: any) => !m.isFromMe && m.rowId > capturedRowId);
        for (const msg of incoming) {
          collectedChunks.push(msg.text);
          onChunk(msg.text);
          capturedRowId = Math.max(capturedRowId, msg.rowId);
          if (options.onRowIdAdvance) {
            options.onRowIdAdvance(msg.rowId);
          }
        }
      });

      doPoll();
    });
  };
}

/**
 * Create a PollFn backed by imsg watch (event-driven, ~500ms latency).
 * Falls back gracefully if imsg is not installed.
 */
export function createImsgPollFn(watcher: ImsgWatcher, options: PollOptions = {}): PollFn {
  const {
    timeoutMs = 180_000,
    silenceThreshold = 5, // fewer checks needed — imsg is event-driven
    pollIntervalMs = 1000,
  } = options;

  return (onChunk: (text: string) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      watcher.clearCallbacks();

      let silenceChecks = 0;
      let gotFirstMessage = false;
      let extraWaits = 0;
      const collectedChunks: string[] = [];

      const timeoutId = setTimeout(() => {
        cleanup();
        if (collectedChunks.length > 0) {
          resolve(collectedChunks.join("\n"));
        } else {
          reject(new Error("Timed out waiting for response"));
        }
      }, timeoutMs);

      let silenceTimer: ReturnType<typeof setTimeout> | null = null;

      function cleanup() {
        if (silenceTimer) clearTimeout(silenceTimer);
        clearTimeout(timeoutId);
        watcher.clearCallbacks();
      }

      function checkSilence() {
        if (gotFirstMessage) {
          silenceChecks++;
          if (silenceChecks >= silenceThreshold) {
            // Check for incomplete blocks — keep waiting if write/edit is mid-stream
            const accumulated = collectedChunks.join("\n");
            if (hasIncompleteBlock(accumulated) && extraWaits < 3) {
              extraWaits++;
              silenceChecks = 0; // reset silence counter, keep waiting
            } else {
              cleanup();
              resolve(accumulated);
              return;
            }
          }
        }
        silenceTimer = setTimeout(checkSilence, pollIntervalMs);
      }

      watcher.onMessage((msg) => {
        if (msg.text) {
          collectedChunks.push(msg.text);
          onChunk(msg.text);
          gotFirstMessage = true;
          silenceChecks = 0; // reset silence counter on each message

          if (options.onRowIdAdvance) {
            options.onRowIdAdvance(msg.id);
          }
        }
      });

      // Start silence checking
      silenceTimer = setTimeout(checkSilence, pollIntervalMs);
    });
  };
}

export type SendResultsFn = (text: string) => Promise<void>;

export interface ConversationOptions {
  apiClient: PokeApiClient;
  executor: ToolExecutor;
  contextBuilder: ContextBuilder;
  cwd: string;
  systemPrompt?: string;
  noTools?: boolean;
  maxToolLoops?: number;
  pollFn: PollFn;
  sendResultsFn?: SendResultsFn; // Optional: imsg send for tool results (bypasses API)
}

export async function* conversationLoop(
  userMessage: string,
  options: ConversationOptions,
): AsyncGenerator<ConversationEvent> {
  const {
    apiClient,
    executor,
    contextBuilder,
    cwd,
    systemPrompt,
    noTools = false,
    maxToolLoops = 10,
    pollFn,
    sendResultsFn,
  } = options;

  // Build context and send initial message
  const fullMessage = contextBuilder.build(userMessage, systemPrompt);
  try {
    await apiClient.sendMessage(fullMessage);
  } catch (err) {
    yield { type: "error", message: err instanceof Error ? err.message : String(err) };
    return;
  }

  let loopCount = 0;

  while (true) {
    // Poll for Poke's response, collecting chunks for streaming
    const chunks: string[] = [];
    let fullResponse: string;
    try {
      fullResponse = await pollFn((chunk) => {
        chunks.push(chunk);
      });
    } catch (err) {
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
      return;
    }

    // Yield text events for each chunk collected during polling
    for (const chunk of chunks) {
      yield { type: "text", content: chunk };
    }

    // Parse for tool calls: try XML → bracket format → natural language intent
    const parsed = parseResponse(fullResponse);
    let toolCalls = parsed.toolCalls;

    if (toolCalls.length === 0) {
      toolCalls = parseBrackets(fullResponse, cwd);
    }

    if (toolCalls.length === 0) {
      toolCalls = parseIntent(fullResponse, cwd);
    }

    if (toolCalls.length === 0 || noTools) {
      yield { type: "done" };
      return;
    }

    // Safety valve
    loopCount++;
    if (loopCount > maxToolLoops) {
      yield { type: "error", message: `Too many tool loops (max: ${maxToolLoops})` };
      return;
    }

    // Execute tool calls
    for (const toolCall of toolCalls) {
      yield { type: "tool_use", toolCall };
    }

    const results = await executor.execute(toolCalls);
    for (const result of results) {
      yield { type: "tool_result", result };
    }

    // Send tool results back to Poke — prefer imsg send (direct) over API
    yield { type: "sending_results", count: results.length };
    const contextReminder = `[Context: User asked: "${userMessage}"]\n\n`;
    const formatted = contextReminder + executor.formatResults(results);
    try {
      if (sendResultsFn) {
        await sendResultsFn(formatted);
      } else {
        await apiClient.sendMessage(formatted);
      }
    } catch (err) {
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
      return;
    }

    // Loop: poll for next response
  }
}
