import { describe, it, expect, vi } from 'vitest';
import { createPollFn } from '../../src/api/conversation.js';

function createMockPoller(messagesPerPoll: Array<Array<{ rowId: number; text: string; isFromMe: boolean }>>) {
  let pollIndex = 0;
  let callbacks: Array<(msgs: any[]) => void> = [];

  return {
    clearCallbacks: vi.fn(() => { callbacks = []; }),
    onMessages: vi.fn((cb: any) => { callbacks.push(cb); }),
    loadInitialMessages: vi.fn(() => []),
    pollOnce: vi.fn(() => {
      const msgs = messagesPerPoll[pollIndex] ?? [];
      pollIndex++;
      if (msgs.length > 0) {
        for (const cb of callbacks) {
          cb(msgs);
        }
      }
    }),
  };
}

describe('createPollFn', () => {
  it('collects chunks from poller and returns full response', async () => {
    const poller = createMockPoller([
      [{ rowId: 100, text: 'Hello ', isFromMe: false }],
      [{ rowId: 101, text: 'world!', isFromMe: false }],
      [], [], [], [], [], [], [], [], // 10 empty polls = silence threshold
    ]);

    const pollFn = createPollFn(poller as any, 0, { pollIntervalMs: 1 });
    const chunks: string[] = [];
    const result = await pollFn((chunk) => chunks.push(chunk));

    expect(chunks).toEqual(['Hello ', 'world!']);
    expect(result).toBe('Hello \nworld!');
  });

  it('filters out isFromMe messages', async () => {
    const poller = createMockPoller([
      [{ rowId: 100, text: 'from poke', isFromMe: false }],
      [{ rowId: 101, text: 'my echo', isFromMe: true }],
      [], [], [], [], [], [], [], [],
    ]);

    const pollFn = createPollFn(poller as any, 0, { pollIntervalMs: 1 });
    const chunks: string[] = [];
    const result = await pollFn((chunk) => chunks.push(chunk));

    expect(chunks).toEqual(['from poke']);
    expect(result).toBe('from poke');
  });

  it('times out if no messages arrive', async () => {
    const poller = createMockPoller([
      [], [], [], [], [], [], [], [], [], [],
      [], [], [], [], [], [], [], [], [], [],
    ]);

    const pollFn = createPollFn(poller as any, 0, { timeoutMs: 100, pollIntervalMs: 10 });

    await expect(pollFn(() => {})).rejects.toThrow('Timed out waiting for response');
  });
});
