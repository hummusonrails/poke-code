import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ToolExecutor } from '../../src/tools/executor.js';
import { executeTool } from '../../src/tools/executor.js';
import { ToolRegistry } from '../../src/tools/registry.js';
import type { ToolCall, ToolEvent } from '../../src/types.js';

const fixturesDir = join(import.meta.dirname, '__fixtures__', 'executor');

beforeAll(() => {
  mkdirSync(fixturesDir, { recursive: true });
  writeFileSync(join(fixturesDir, 'hello.txt'), 'hello world\nline two\nline three');
});

afterAll(() => {
  rmSync(fixturesDir, { recursive: true, force: true });
});

describe('ToolExecutor', () => {
  it('executes auto-allowed tools without prompting (read_file in default mode)', async () => {
    const registry = new ToolRegistry();
    const promptFn = async (_call: ToolCall) => {
      throw new Error('promptFn should not be called for auto-allowed tools');
    };
    const executor = new ToolExecutor(registry, 'default', promptFn);

    const call: ToolCall = { tool: 'read_file', params: { path: join(fixturesDir, 'hello.txt') } };
    const results = await executor.execute([call]);

    expect(results).toHaveLength(1);
    expect(results[0].error).toBeUndefined();
    expect(results[0].output).toContain('hello world');
  });

  it('returns error for unknown tools', async () => {
    const registry = new ToolRegistry();
    const executor = new ToolExecutor(registry, 'default');

    const call: ToolCall = { tool: 'nonexistent_tool', params: {} };
    const results = await executor.execute([call]);

    expect(results).toHaveLength(1);
    expect(results[0].error).toContain('Unknown tool: nonexistent_tool');
    expect(results[0].output).toBe('');
  });

  it('returns error for denied tools in readonly mode', async () => {
    const registry = new ToolRegistry();
    const executor = new ToolExecutor(registry, 'readonly');

    const call: ToolCall = { tool: 'write_file', params: { path: '/tmp/test.txt', content: 'data' } };
    const results = await executor.execute([call]);

    expect(results).toHaveLength(1);
    expect(results[0].error).toContain('denied');
    expect(results[0].error).toContain('readonly');
    expect(results[0].output).toBe('');
  });

  it('auto-allows write tools in trusted mode without prompting', async () => {
    const registry = new ToolRegistry();
    const tmpFile = join(fixturesDir, 'trusted-write.txt');
    const promptFn = async (_call: ToolCall) => {
      throw new Error('promptFn should not be called in trusted mode');
    };
    const executor = new ToolExecutor(registry, 'trusted', promptFn);

    const call: ToolCall = { tool: 'write_file', params: { path: tmpFile, content: 'trusted content' } };
    const results = await executor.execute([call]);

    expect(results).toHaveLength(1);
    expect(results[0].error).toBeUndefined();
  });

  it('formats results with [tool] header and <result> tags', async () => {
    const registry = new ToolRegistry();
    const executor = new ToolExecutor(registry, 'default');

    const results = [
      { tool: 'read_file', params: { path: '/some/file.txt' }, output: 'file contents here' },
      { tool: 'bash', params: { command: 'echo hello' }, output: '', error: 'Tool bash was denied by user' },
    ];

    const formatted = executor.formatResults(results);

    expect(formatted).toContain('[read_file]');
    expect(formatted).toContain('[bash]');
    expect(formatted).toContain('<result>');
    expect(formatted).toContain('</result>');
    expect(formatted).toContain('file contents here');
    expect(formatted).toContain('Error: Tool bash was denied by user');
    expect(formatted).toMatch(/^Tool results:/);
  });
});

describe('executeTool generator', () => {
  it('yields progress then result for a successful tool call', async () => {
    const registry = new ToolRegistry();
    const call: ToolCall = { tool: 'read_file', params: { path: join(fixturesDir, 'hello.txt') } };

    const events: ToolEvent[] = [];
    for await (const event of executeTool(call, registry, 'default', async () => true)) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].type).toBe('progress');
    if (events[0].type === 'progress') {
      expect(events[0].tool).toBe('read_file');
    }
    const resultEvent = events.find(e => e.type === 'result');
    expect(resultEvent).toBeDefined();
    if (resultEvent?.type === 'result') {
      expect(resultEvent.result.output).toContain('hello world');
      expect(resultEvent.result.error).toBeUndefined();
    }
  });

  it('yields result with error for unknown tools', async () => {
    const registry = new ToolRegistry();
    const call: ToolCall = { tool: 'nope', params: {} };

    const events: ToolEvent[] = [];
    for await (const event of executeTool(call, registry, 'default', async () => true)) {
      events.push(event);
    }

    const resultEvent = events.find(e => e.type === 'result');
    expect(resultEvent).toBeDefined();
    if (resultEvent?.type === 'result') {
      expect(resultEvent.result.error).toContain('Unknown tool: nope');
    }
  });

  it('yields result with error when permission denied', async () => {
    const registry = new ToolRegistry();
    const call: ToolCall = { tool: 'bash', params: { command: 'echo hi' } };
    const denyAll = async () => false;

    const events: ToolEvent[] = [];
    for await (const event of executeTool(call, registry, 'default', denyAll)) {
      events.push(event);
    }

    const resultEvent = events.find(e => e.type === 'result');
    expect(resultEvent).toBeDefined();
    if (resultEvent?.type === 'result') {
      expect(resultEvent.result.error).toContain('denied');
    }
  });
});
