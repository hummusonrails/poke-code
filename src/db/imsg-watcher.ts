import { spawn, execFileSync, type ChildProcess } from 'node:child_process';

/**
 * Message received from imsg watch --json
 */
export interface ImsgMessage {
  id: number;
  chat_id: number;
  guid: string;
  sender: string;
  is_from_me: boolean;
  text: string;
  created_at: string;
  attachments: Array<{ filename: string; mime_type: string; total_bytes: number }>;
}

type MessageCallback = (msg: ImsgMessage) => void;

/**
 * Wraps `imsg watch` for real-time iMessage streaming.
 * Replaces ChatDbPoller with event-driven filesystem watching (500ms latency vs 1.5s polling).
 */
export class ImsgWatcher {
  private chatId: number;
  private process: ChildProcess | null = null;
  private callbacks: MessageCallback[] = [];
  private buffer = '';
  private lastSeenId = 0;
  private alive = false;

  constructor(chatId: number) {
    this.chatId = chatId;
  }

  /**
   * Start watching for new messages.
   * Spawns `imsg watch --chat-id X --json --debounce 500ms`
   */
  start(sinceRowId?: number): void {
    if (this.process) return;

    const args = [
      'watch',
      '--chat-id', String(this.chatId),
      '--json',
      '--debounce', '500ms',
    ];

    if (sinceRowId) {
      args.push('--since-rowid', String(sinceRowId));
    }

    this.process = spawn('imsg', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.alive = true;

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      const msg = chunk.toString().trim();
      if (msg) {
        process.stderr.write(`[imsg] ${msg}\n`);
      }
    });

    this.process.on('error', (err) => {
      this.alive = false;
      process.stderr.write(`[imsg] process error: ${err.message}\n`);
    });

    this.process.on('exit', (code) => {
      this.alive = false;
      if (code !== 0 && code !== null) {
        process.stderr.write(`[imsg] exited with code ${code}\n`);
      }
      this.process = null;
    });
  }

  /**
   * Process buffered JSONL output — one JSON object per line.
   */
  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    // Keep the last (possibly incomplete) line in the buffer
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const msg = JSON.parse(trimmed) as ImsgMessage;
        // Skip our own messages and already-seen messages
        if (msg.is_from_me) continue;
        if (msg.id <= this.lastSeenId) continue;

        this.lastSeenId = msg.id;

        for (const cb of this.callbacks) {
          cb(msg);
        }
      } catch {
        // Malformed JSON line — skip
      }
    }
  }

  onMessage(callback: MessageCallback): void {
    this.callbacks.push(callback);
  }

  clearCallbacks(): void {
    this.callbacks = [];
  }

  getLastSeenId(): number {
    return this.lastSeenId;
  }

  isAlive(): boolean {
    return this.alive && this.process !== null && !this.process.killed;
  }

  stop(): void {
    if (this.process && !this.process.killed) {
      this.process.kill();
      this.process = null;
    }
    this.alive = false;
    this.callbacks = [];
    this.buffer = '';
  }
}

/**
 * Check if imsg CLI is installed and working.
 * Actually runs the binary and checks output (synchronous).
 */
export function isImsgAvailable(): boolean {
  try {
    execFileSync('imsg', ['chats', '--limit', '1', '--json'], {
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}
