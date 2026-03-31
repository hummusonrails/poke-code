import { homedir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import type { HandleInfo, Message } from "../types.js";
import { extractTextFromAttributedBody } from "./attributed-body.js";

const APPLE_EPOCH_OFFSET = 978307200; // seconds between Unix epoch and Apple epoch (2001-01-01)
const OBJECT_REPLACEMENT_CHAR = "\uFFFC";

const TAPBACK_MIN = 2000;
const TAPBACK_MAX = 5005;

const POLL_QUERY = `
  SELECT m.ROWID, m.text, m.attributedBody, m.date, m.is_from_me,
         m.cache_has_attachments, m.associated_message_type
  FROM message m
  JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
  WHERE cmj.chat_id = ? AND m.ROWID > ?
  ORDER BY m.ROWID ASC
`;

const INITIAL_MESSAGES_QUERY = `
  SELECT m.ROWID, m.text, m.attributedBody, m.date, m.is_from_me,
         m.cache_has_attachments, m.associated_message_type
  FROM message m
  JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
  WHERE cmj.chat_id = ?
  ORDER BY m.ROWID DESC
  LIMIT 50
`;

const RECENT_HANDLES_QUERY = `
  SELECT h.ROWID, h.id, c.ROWID as chatRowId
  FROM handle h
  JOIN chat_handle_join chj ON h.ROWID = chj.handle_id
  JOIN chat c ON chj.chat_id = c.ROWID
  ORDER BY c.last_read_message_timestamp DESC
  LIMIT 20
`;

interface RawMessageRow {
  ROWID: number;
  text: string | null;
  attributedBody: Buffer | null;
  date: number;
  is_from_me: number;
  cache_has_attachments: number;
  associated_message_type: number;
}

interface RawHandleRow {
  ROWID: number;
  id: string;
  chatRowId: number;
}

function appleTimestampToDate(appleNano: number): Date {
  // date is stored as nanoseconds since Apple epoch
  const appleSeconds = appleNano / 1_000_000_000;
  const unixSeconds = appleSeconds + APPLE_EPOCH_OFFSET;
  return new Date(unixSeconds * 1000);
}

function parseRow(row: RawMessageRow): Message | null {
  // Filter out tapback reactions
  const amt = row.associated_message_type;
  if (amt >= TAPBACK_MIN && amt <= TAPBACK_MAX) {
    return null;
  }

  // Try text column first, fall back to attributedBody
  let text: string | null = row.text ?? null;

  // Remove object replacement characters
  if (text) {
    text = text.replace(new RegExp(OBJECT_REPLACEMENT_CHAR, "g"), "").trim();
  }

  // If text column is empty or only had replacement chars, try attributedBody
  if ((!text || text.length === 0) && row.attributedBody) {
    text = extractTextFromAttributedBody(row.attributedBody);
  }

  // Skip messages with no usable text
  if (!text || text.length === 0) {
    return null;
  }

  return {
    rowId: row.ROWID,
    text,
    isFromMe: row.is_from_me === 1,
    date: appleTimestampToDate(row.date),
    hasAttachments: row.cache_has_attachments === 1,
  };
}

export class ChatDbPoller {
  private db: Database.Database;
  private chatId: number | null = null;
  private lastSeenRowId: number = 0;
  private callbacks: Array<(messages: Message[]) => void> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: boolean = false;
  private pollInterval: number;
  private fastPollTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly normalInterval: number;
  private readonly fastInterval: number;
  private readonly fastDuration: number;

  constructor(
    dbPath: string = join(homedir(), "Library", "Messages", "chat.db"),
    options: { normalInterval?: number; fastInterval?: number; fastDuration?: number } = {},
  ) {
    this.normalInterval = options.normalInterval ?? 3000;
    this.fastInterval = options.fastInterval ?? 1500;
    this.fastDuration = options.fastDuration ?? 30000;
    this.pollInterval = this.normalInterval;

    this.db = new Database(dbPath, { readonly: true });
    // Enable WAL mode visibility for readonly connections
    this.db.pragma("journal_mode = WAL");
  }

  fetchRecentHandles(): HandleInfo[] {
    const stmt = this.db.prepare<[], RawHandleRow>(RECENT_HANDLES_QUERY);
    const rows = stmt.all();
    return rows.map((row) => ({
      rowId: row.ROWID,
      identifier: row.id,
      chatId: row.chatRowId,
    }));
  }

  setHandle(handleId: number, chatId: number): void {
    this.handleId = handleId;
    this.chatId = chatId;
  }

  loadInitialMessages(): Message[] {
    if (this.chatId === null) {
      throw new Error("No chat selected. Call setHandle() first.");
    }

    const stmt = this.db.prepare<[number], RawMessageRow>(INITIAL_MESSAGES_QUERY);
    const rows = stmt.all(this.chatId);

    // rows come back DESC, reverse to get chronological order
    rows.reverse();

    const messages: Message[] = [];
    for (const row of rows) {
      const msg = parseRow(row);
      if (msg) {
        messages.push(msg);
      }
    }

    if (rows.length > 0) {
      // lastSeenRowId = max ROWID in the result set
      this.lastSeenRowId = Math.max(...rows.map((r) => r.ROWID));
    }

    return messages;
  }

  onMessages(callback: (messages: Message[]) => void): void {
    this.callbacks.push(callback);
  }

  clearCallbacks(): void {
    this.callbacks = [];
  }

  pollOnce(): void {
    if (this.chatId === null) return;

    const stmt = this.db.prepare<[number, number], RawMessageRow>(POLL_QUERY);
    const rows = stmt.all(this.chatId, this.lastSeenRowId);

    const messages: Message[] = [];
    for (const row of rows) {
      const msg = parseRow(row);
      if (msg) {
        messages.push(msg);
      }
      // Advance lastSeenRowId even for filtered rows (tapbacks, etc.)
      if (row.ROWID > this.lastSeenRowId) {
        this.lastSeenRowId = row.ROWID;
      }
    }

    if (messages.length > 0) {
      for (const cb of this.callbacks) {
        cb(messages);
      }
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.fastPollTimer !== null) {
      clearTimeout(this.fastPollTimer);
      this.fastPollTimer = null;
    }
  }

  enterFastPollMode(): void {
    this.pollInterval = this.fastInterval;

    // Clear any existing fast poll timeout
    if (this.fastPollTimer !== null) {
      clearTimeout(this.fastPollTimer);
    }

    // Revert to normal after fastDuration
    this.fastPollTimer = setTimeout(() => {
      this.pollInterval = this.normalInterval;
      this.fastPollTimer = null;
    }, this.fastDuration);
  }

  close(): void {
    this.stop();
    this.db.close();
  }

  private scheduleNext(): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      try {
        this.pollOnce();
      } catch {
        // Swallow errors to keep polling alive
      }
      this.scheduleNext();
    }, this.pollInterval);
  }
}
