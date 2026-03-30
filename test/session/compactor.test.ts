import { describe, it, expect } from 'vitest';
import { compactHistory } from '../../src/session/compactor.js';
import type { SessionEntry } from '../../src/types.js';

describe('compactHistory', () => {
  it('returns empty string for empty entries', () => {
    expect(compactHistory([])).toBe('');
  });

  it('preserves user messages', () => {
    const entries: SessionEntry[] = [
      { role: 'user', content: 'What files are in this project?', timestamp: '2024-01-01T00:00:00Z' },
    ];
    const result = compactHistory(entries);
    expect(result).toContain('What files are in this project?');
  });

  it('summarizes conversation with both user and assistant text', () => {
    const entries: SessionEntry[] = [
      { role: 'user', content: 'List the files', timestamp: '2024-01-01T00:00:00Z' },
      { role: 'assistant', content: 'Here are the files in the project.', timestamp: '2024-01-01T00:00:01Z' },
    ];
    const result = compactHistory(entries);
    expect(result).toContain('List the files');
    expect(result).toContain('Here are the files in the project.');
    expect(result.length).toBeLessThan(
      entries.map(e => e.content ?? '').join('').length * 10
    );
  });

  it('truncates long assistant responses to 200 chars', () => {
    const longContent = 'a'.repeat(300);
    const entries: SessionEntry[] = [
      { role: 'assistant', content: longContent, timestamp: '2024-01-01T00:00:00Z' },
    ];
    const result = compactHistory(entries);
    expect(result).toContain('...');
    // The truncated text portion should be 200 chars + '...'
    expect(result).toContain('a'.repeat(200) + '...');
    expect(result).not.toContain('a'.repeat(201) + '...');
  });

  it('skips tool result entries', () => {
    const entries: SessionEntry[] = [
      { role: 'user', content: 'Run a command', timestamp: '2024-01-01T00:00:00Z' },
      {
        role: 'tool',
        results: [{ tool: 'bash', params: { command: 'ls' }, output: 'file1.ts\nfile2.ts' }],
        timestamp: '2024-01-01T00:00:01Z',
      },
    ];
    const result = compactHistory(entries);
    expect(result).toContain('Run a command');
    expect(result).not.toContain('file1.ts');
  });

  it('includes tool call names in assistant entries', () => {
    const entries: SessionEntry[] = [
      {
        role: 'assistant',
        content: 'Let me check that file.',
        toolCalls: [{ tool: 'read_file', params: { path: 'src/index.ts' } }],
        timestamp: '2024-01-01T00:00:00Z',
      },
    ];
    const result = compactHistory(entries);
    expect(result).toContain('read_file(src/index.ts)');
    expect(result).toContain('Tools used:');
  });

  it('includes the summary header', () => {
    const entries: SessionEntry[] = [
      { role: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
    ];
    const result = compactHistory(entries);
    expect(result).toContain('## Conversation Summary');
  });
});
