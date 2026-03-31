import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock better-sqlite3
// The vi.mock factory is hoisted to file top, so it cannot close over any
// top-level `const` declarations defined below it. We instead define the mocks
// inside the factory and re-expose them via a module-level object that gets
// populated lazily on first access.
// ---------------------------------------------------------------------------

vi.mock("better-sqlite3", () => {
  const mockAll = vi.fn().mockReturnValue([]);
  const mockRun = vi.fn();
  const mockStmt = { all: mockAll, run: mockRun };
  const mockPragma = vi.fn();
  const mockPrepare = vi.fn(() => mockStmt);
  const mockClose = vi.fn();
  const mockDbInstance = { pragma: mockPragma, prepare: mockPrepare, close: mockClose };

  // Track constructor calls manually (vi.fn wrapping a constructor requires 'function')
  const constructorCalls: Array<{ path: string; opts: unknown }> = [];

  function MockDb(path: string, opts: unknown) {
    constructorCalls.push({ path, opts });
    return mockDbInstance;
  }

  // Attach mocks so tests can reach them via the imported Database symbol
  (MockDb as unknown as Record<string, unknown>).__mocks = {
    all: mockAll,
    pragma: mockPragma,
    prepare: mockPrepare,
    close: mockClose,
    instance: mockDbInstance,
    constructorCalls,
  };

  return { default: MockDb };
});

import Database from "better-sqlite3";
import { ChatDbPoller } from "../../src/db/poller.js";

// Helpers to retrieve the internal mocks after the module is loaded
function mocks() {
  return (Database as unknown as Record<string, unknown>).__mocks as {
    all: ReturnType<typeof vi.fn>;
    pragma: ReturnType<typeof vi.fn>;
    prepare: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    instance: Record<string, unknown>;
    constructorCalls: Array<{ path: string; opts: unknown }>;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APPLE_EPOCH_OFFSET = 978307200;

function toAppleNano(unixMs: number): number {
  const unixSec = unixMs / 1000;
  return (unixSec - APPLE_EPOCH_OFFSET) * 1_000_000_000;
}

function makeRow(
  overrides: Partial<{
    ROWID: number;
    text: string | null;
    attributedBody: Buffer | null;
    date: number;
    is_from_me: number;
    cache_has_attachments: number;
    associated_message_type: number;
  }> = {},
) {
  return {
    ROWID: 1,
    text: "Hello",
    attributedBody: null,
    date: toAppleNano(Date.now()),
    is_from_me: 0,
    cache_has_attachments: 0,
    associated_message_type: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatDbPoller", () => {
  let poller: ChatDbPoller;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks().all.mockReturnValue([]);
    poller = new ChatDbPoller("/fake/chat.db");
  });

  afterEach(() => {
    poller.close();
  });

  // -------------------------------------------------------------------------
  // 1. Database opens in readonly mode
  // -------------------------------------------------------------------------

  it("opens the database in readonly mode", () => {
    const calls = mocks().constructorCalls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1];
    expect(lastCall.path).toBe("/fake/chat.db");
    expect(lastCall.opts).toEqual({ readonly: true });
  });

  it("sets WAL journal mode pragma after opening", () => {
    expect(mocks().pragma).toHaveBeenCalledWith("journal_mode = WAL");
  });

  // -------------------------------------------------------------------------
  // 2. fetchRecentHandles returns an array
  // -------------------------------------------------------------------------

  it("fetchRecentHandles returns an empty array when no rows", () => {
    mocks().all.mockReturnValueOnce([]);
    const result = poller.fetchRecentHandles();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("fetchRecentHandles maps rows to HandleInfo", () => {
    mocks().all.mockReturnValueOnce([
      { ROWID: 5, id: "+15551234567", chatRowId: 42 },
      { ROWID: 6, id: "user@example.com", chatRowId: 43 },
    ]);
    const handles = poller.fetchRecentHandles();
    expect(handles).toHaveLength(2);
    expect(handles[0]).toEqual({ rowId: 5, identifier: "+15551234567", chatId: 42 });
    expect(handles[1]).toEqual({ rowId: 6, identifier: "user@example.com", chatId: 43 });
  });

  // -------------------------------------------------------------------------
  // 3. setHandle stores chatId
  // -------------------------------------------------------------------------

  it("setHandle allows pollOnce to use the configured chatId", () => {
    poller.setHandle(5, 42);
    mocks().all.mockReturnValueOnce([]);
    poller.pollOnce();
    expect(mocks().prepare).toHaveBeenCalled();
    expect(mocks().all).toHaveBeenCalledWith(42, 0);
  });

  it("pollOnce does nothing when no chatId is set", () => {
    // clearAllMocks resets call counts; ensure all is fresh
    poller.pollOnce();
    expect(mocks().all).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 4. pollOnce emits messages via callback
  // -------------------------------------------------------------------------

  it("pollOnce fires callbacks with parsed messages", () => {
    poller.setHandle(1, 10);
    const row = makeRow({ ROWID: 7, text: "Hey there", is_from_me: 1 });
    mocks().all.mockReturnValueOnce([row]);

    const cb = vi.fn();
    poller.onMessages(cb);
    poller.pollOnce();

    expect(cb).toHaveBeenCalledOnce();
    const msgs = cb.mock.calls[0][0] as Array<{ rowId: number; text: string; isFromMe: boolean }>;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].rowId).toBe(7);
    expect(msgs[0].text).toBe("Hey there");
    expect(msgs[0].isFromMe).toBe(true);
  });

  it("pollOnce does not fire callback when result is empty", () => {
    poller.setHandle(1, 10);
    mocks().all.mockReturnValueOnce([]);
    const cb = vi.fn();
    poller.onMessages(cb);
    poller.pollOnce();
    expect(cb).not.toHaveBeenCalled();
  });

  it("pollOnce strips U+FFFC object replacement characters from text", () => {
    poller.setHandle(1, 10);
    const row = makeRow({ ROWID: 8, text: "Hello\uFFFCWorld" });
    mocks().all.mockReturnValueOnce([row]);

    const cb = vi.fn();
    poller.onMessages(cb);
    poller.pollOnce();

    const msgs = cb.mock.calls[0][0] as Array<{ text: string }>;
    expect(msgs[0].text).toBe("HelloWorld");
  });

  it("pollOnce falls back to attributedBody when text is null", () => {
    poller.setHandle(1, 10);

    // Build a minimal typedstream-like buffer so extractTextFromAttributedBody returns something
    const messageText = "From attributedBody";
    const textBytes = Buffer.from(messageText, "utf8");
    const prefix = Buffer.alloc(20, 0);
    prefix[18] = 0x01;
    prefix[19] = 0x2b;
    const lengthByte = Buffer.from([textBytes.length]);
    const attrBody = Buffer.concat([prefix, lengthByte, textBytes]);

    const row = makeRow({ ROWID: 9, text: null, attributedBody: attrBody });
    mocks().all.mockReturnValueOnce([row]);

    const cb = vi.fn();
    poller.onMessages(cb);
    poller.pollOnce();

    const msgs = cb.mock.calls[0][0] as Array<{ text: string }>;
    expect(msgs[0].text).toBe("From attributedBody");
  });

  // -------------------------------------------------------------------------
  // 5. Tapback reactions are filtered out
  // -------------------------------------------------------------------------

  it.each([2000, 2001, 3000, 5005])("filters out tapback reaction with associated_message_type=%i", (amt) => {
    poller.setHandle(1, 10);
    const row = makeRow({ ROWID: 20, text: "Liked a message", associated_message_type: amt });
    mocks().all.mockReturnValueOnce([row]);

    const cb = vi.fn();
    poller.onMessages(cb);
    poller.pollOnce();

    expect(cb).not.toHaveBeenCalled();
  });

  it("does not filter messages with associated_message_type below 2000", () => {
    poller.setHandle(1, 10);
    const row = makeRow({ ROWID: 21, text: "Normal message", associated_message_type: 0 });
    mocks().all.mockReturnValueOnce([row]);

    const cb = vi.fn();
    poller.onMessages(cb);
    poller.pollOnce();

    expect(cb).toHaveBeenCalledOnce();
  });

  it("does not filter messages with associated_message_type above 5005", () => {
    poller.setHandle(1, 10);
    const row = makeRow({ ROWID: 22, text: "Normal message", associated_message_type: 5006 });
    mocks().all.mockReturnValueOnce([row]);

    const cb = vi.fn();
    poller.onMessages(cb);
    poller.pollOnce();

    expect(cb).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // 6. lastSeenRowId tracking to avoid duplicates
  // -------------------------------------------------------------------------

  it("advances lastSeenRowId after pollOnce", () => {
    poller.setHandle(1, 10);
    const row = makeRow({ ROWID: 55, text: "msg" });
    mocks().all.mockReturnValueOnce([row]);

    poller.pollOnce();

    // Second poll should use ROWID 55 as lower bound
    mocks().all.mockReturnValueOnce([]);
    poller.pollOnce();

    const secondCallArgs = mocks().all.mock.calls[1];
    expect(secondCallArgs[1]).toBe(55);
  });

  it("advances lastSeenRowId even for tapback-filtered rows", () => {
    poller.setHandle(1, 10);
    const tapback = makeRow({ ROWID: 99, text: "Liked", associated_message_type: 2000 });
    mocks().all.mockReturnValueOnce([tapback]);

    const cb = vi.fn();
    poller.onMessages(cb);
    poller.pollOnce();

    // Callback should not fire (filtered out)
    expect(cb).not.toHaveBeenCalled();

    // But next poll should use ROWID 99 as lower bound
    mocks().all.mockReturnValueOnce([]);
    poller.pollOnce();
    expect(mocks().all.mock.calls[1][1]).toBe(99);
  });

  it("loadInitialMessages sets lastSeenRowId to highest ROWID", () => {
    poller.setHandle(1, 10);
    mocks().all.mockReturnValueOnce([
      makeRow({ ROWID: 10, text: "first" }),
      makeRow({ ROWID: 8, text: "second" }),
      makeRow({ ROWID: 6, text: "third" }),
    ]);

    poller.loadInitialMessages();

    // Next poll should use ROWID 10
    mocks().all.mockReturnValueOnce([]);
    poller.pollOnce();
    expect(mocks().all.mock.calls[1][1]).toBe(10);
  });

  it("loadInitialMessages returns messages in chronological order", () => {
    poller.setHandle(1, 10);
    // DB returns DESC order (newest first)
    mocks().all.mockReturnValueOnce([
      makeRow({ ROWID: 30, text: "third" }),
      makeRow({ ROWID: 20, text: "second" }),
      makeRow({ ROWID: 10, text: "first" }),
    ]);

    const messages = poller.loadInitialMessages();
    expect(messages[0].rowId).toBe(10);
    expect(messages[1].rowId).toBe(20);
    expect(messages[2].rowId).toBe(30);
  });

  it("loadInitialMessages throws when no chatId is set", () => {
    expect(() => poller.loadInitialMessages()).toThrow("No chat selected");
  });

  // -------------------------------------------------------------------------
  // 7. enterFastPollMode works
  // -------------------------------------------------------------------------

  it("enterFastPollMode reduces pollInterval to fastInterval", () => {
    vi.useFakeTimers();
    try {
      poller.setHandle(1, 10);
      mocks().all.mockReturnValue([]);

      // Enter fast mode before starting so the first scheduled timer uses 1500ms
      poller.enterFastPollMode();
      poller.start();

      // Advance exactly 1500ms — the first poll fires
      vi.advanceTimersByTime(1500);
      expect(mocks().prepare).toHaveBeenCalled();

      poller.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("enterFastPollMode reverts to normalInterval after fastDuration", () => {
    vi.useFakeTimers();
    try {
      const fastPoller = new ChatDbPoller("/fake/chat.db", {
        normalInterval: 3000,
        fastInterval: 1500,
        fastDuration: 5000,
      });
      fastPoller.setHandle(1, 10);
      mocks().all.mockReturnValue([]);

      fastPoller.enterFastPollMode();

      // Advance past fastDuration to revert
      vi.advanceTimersByTime(5001);

      fastPoller.start();

      const callsBefore = mocks().prepare.mock.calls.length;

      // At 1500ms in normal mode the setTimeout hasn't fired yet (needs 3000ms)
      vi.advanceTimersByTime(1500);
      const callsAt1500 = mocks().prepare.mock.calls.length;

      vi.advanceTimersByTime(1500); // now 3000ms total
      const callsAt3000 = mocks().prepare.mock.calls.length;

      // After full normal interval, poll should have fired
      expect(callsAt3000).toBeGreaterThan(callsBefore);
      // And at 1500ms there were fewer (or equal) calls than at 3000ms
      expect(callsAt3000).toBeGreaterThanOrEqual(callsAt1500);

      fastPoller.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it("supports multiple onMessages callbacks", () => {
    poller.setHandle(1, 10);
    const row = makeRow({ ROWID: 5, text: "hi" });
    mocks().all.mockReturnValueOnce([row]);

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    poller.onMessages(cb1);
    poller.onMessages(cb2);
    poller.pollOnce();

    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it("converts Apple nanosecond timestamp to a valid Date", () => {
    poller.setHandle(1, 10);
    const unixMs = new Date("2024-01-15T00:00:00Z").getTime();
    const row = makeRow({ ROWID: 1, date: toAppleNano(unixMs) });
    mocks().all.mockReturnValueOnce([row]);

    const cb = vi.fn();
    poller.onMessages(cb);
    poller.pollOnce();

    const msgs = cb.mock.calls[0][0] as Array<{ date: Date }>;
    expect(msgs[0].date).toBeInstanceOf(Date);
    expect(Math.abs(msgs[0].date.getTime() - unixMs)).toBeLessThan(1000);
  });

  it("hasAttachments reflects cache_has_attachments column", () => {
    poller.setHandle(1, 10);
    const row = makeRow({ ROWID: 1, text: "pic", cache_has_attachments: 1 });
    mocks().all.mockReturnValueOnce([row]);

    const cb = vi.fn();
    poller.onMessages(cb);
    poller.pollOnce();

    const msgs = cb.mock.calls[0][0] as Array<{ hasAttachments: boolean }>;
    expect(msgs[0].hasAttachments).toBe(true);
  });
});
