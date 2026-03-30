import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readFileTool } from '../../src/tools/read-file.js';

const fixturesDir = join(import.meta.dirname, '__fixtures__', 'read-file');

beforeAll(() => {
  mkdirSync(fixturesDir, { recursive: true });
  writeFileSync(join(fixturesDir, 'sample.txt'), 'line1\nline2\nline3\nline4\nline5');
});

afterAll(() => {
  rmSync(fixturesDir, { recursive: true, force: true });
});

describe('readFileTool', () => {
  it('reads entire file with line numbers', async () => {
    const result = await readFileTool({ path: join(fixturesDir, 'sample.txt') });
    expect(result).toBe('1\tline1\n2\tline2\n3\tline3\n4\tline4\n5\tline5');
  });

  it('respects limit', async () => {
    const result = await readFileTool({ path: join(fixturesDir, 'sample.txt'), limit: 2 });
    expect(result).toBe('1\tline1\n2\tline2');
  });

  it('respects offset', async () => {
    const result = await readFileTool({ path: join(fixturesDir, 'sample.txt'), offset: 3 });
    expect(result).toBe('3\tline3\n4\tline4\n5\tline5');
  });

  it('respects both limit and offset', async () => {
    const result = await readFileTool({ path: join(fixturesDir, 'sample.txt'), offset: 2, limit: 2 });
    expect(result).toBe('2\tline2\n3\tline3');
  });

  it('throws on missing file', async () => {
    await expect(readFileTool({ path: join(fixturesDir, 'nonexistent.txt') })).rejects.toThrow();
  });

  it('applies syntax highlighting for known extensions', async () => {
    const filePath = join(fixturesDir, 'highlight.ts');
    writeFileSync(filePath, 'const x: number = 42;\n');

    const result = await readFileTool({ path: filePath });
    expect(result).toContain('const');
    expect(result).toContain('42');
    // Check for ANSI escape codes (the \x1b[ prefix)
    expect(result).toMatch(/\x1b\[/);
  });

  it('returns plain text for unknown extensions', async () => {
    const filePath = join(fixturesDir, 'plain.xyz');
    writeFileSync(filePath, 'just plain text\n');

    const result = await readFileTool({ path: filePath });
    expect(result).toContain('just plain text');
    // No ANSI codes for unknown extensions
    expect(result).not.toMatch(/\x1b\[/);
  });
});
