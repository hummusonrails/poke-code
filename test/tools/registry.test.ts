import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../../src/tools/registry.js';
import type { PermissionMode, ToolPermission } from '../../src/types.js';

describe('ToolRegistry', () => {
  it('registers and retrieves all default tools', () => {
    const registry = new ToolRegistry();
    const tools = registry.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'bash', 'edit_file', 'glob', 'grep', 'list_dir', 'read_file', 'web_fetch', 'web_search', 'write_file',
    ]);
  });

  it('returns correct permission for read tools in default mode', () => {
    const registry = new ToolRegistry();
    expect(registry.getPermission('read_file', 'default')).toBe('auto');
    expect(registry.getPermission('glob', 'default')).toBe('auto');
    expect(registry.getPermission('grep', 'default')).toBe('auto');
    expect(registry.getPermission('list_dir', 'default')).toBe('auto');
  });

  it('returns ask permission for write tools in default mode', () => {
    const registry = new ToolRegistry();
    expect(registry.getPermission('write_file', 'default')).toBe('ask');
    expect(registry.getPermission('edit_file', 'default')).toBe('ask');
    expect(registry.getPermission('bash', 'default')).toBe('ask');
  });

  it('returns auto for all tools in trusted mode', () => {
    const registry = new ToolRegistry();
    expect(registry.getPermission('bash', 'trusted')).toBe('auto');
    expect(registry.getPermission('write_file', 'trusted')).toBe('auto');
  });

  it('returns deny for write tools in readonly mode', () => {
    const registry = new ToolRegistry();
    expect(registry.getPermission('bash', 'readonly')).toBe('deny');
    expect(registry.getPermission('write_file', 'readonly')).toBe('deny');
    expect(registry.getPermission('edit_file', 'readonly')).toBe('deny');
  });

  it('returns auto for read tools in readonly mode', () => {
    const registry = new ToolRegistry();
    expect(registry.getPermission('read_file', 'readonly')).toBe('auto');
    expect(registry.getPermission('glob', 'readonly')).toBe('auto');
  });

  it('returns deny for unknown tools', () => {
    const registry = new ToolRegistry();
    expect(registry.getPermission('unknown_tool', 'default')).toBe('deny');
  });

  it('generates system prompt schema', () => {
    const registry = new ToolRegistry();
    const schema = registry.generateToolSchema();
    expect(schema).toContain('read_file');
    expect(schema).toContain('write_file');
    expect(schema).toContain('<tool_call>');
  });
});
