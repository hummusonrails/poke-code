import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileTool } from '../../src/tools/write-file.js';

const fixturesDir = join(import.meta.dirname, '__fixtures__', 'write-file');

beforeAll(() => {
  mkdirSync(fixturesDir, { recursive: true });
});

afterAll(() => {
  rmSync(fixturesDir, { recursive: true, force: true });
});

describe('writeFileTool', () => {
  it('creates a new file', async () => {
    const filePath = join(fixturesDir, 'new.txt');
    const result = await writeFileTool({ path: filePath, content: 'hello world' });
    expect(result).toContain(filePath);
    expect(readFileSync(filePath, 'utf-8')).toBe('hello world');
  });

  it('overwrites an existing file', async () => {
    const filePath = join(fixturesDir, 'overwrite.txt');
    await writeFileTool({ path: filePath, content: 'original' });
    await writeFileTool({ path: filePath, content: 'updated' });
    expect(readFileSync(filePath, 'utf-8')).toBe('updated');
  });

  it('creates intermediate directories', async () => {
    const filePath = join(fixturesDir, 'deep', 'nested', 'file.txt');
    await writeFileTool({ path: filePath, content: 'deep content' });
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, 'utf-8')).toBe('deep content');
  });

  it('returns message with byte count', async () => {
    const filePath = join(fixturesDir, 'bytes.txt');
    const content = 'abc';
    const result = await writeFileTool({ path: filePath, content });
    expect(result).toContain('3 bytes');
  });
});
