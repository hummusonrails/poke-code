import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { grepTool } from '../../src/tools/grep.js';

const fixturesDir = join(import.meta.dirname, '__fixtures__', 'grep');

beforeAll(() => {
  mkdirSync(join(fixturesDir, 'sub'), { recursive: true });
  writeFileSync(join(fixturesDir, 'a.txt'), 'hello world\nfoo bar\nbaz');
  writeFileSync(join(fixturesDir, 'b.txt'), 'no match here\nalso nothing');
  writeFileSync(join(fixturesDir, 'sub', 'c.txt'), 'hello from subdir');
});

afterAll(() => {
  rmSync(fixturesDir, { recursive: true, force: true });
});

describe('grepTool', () => {
  it('finds lines matching a pattern', async () => {
    const result = await grepTool({ pattern: 'hello', path: fixturesDir });
    expect(result).toContain('a.txt:1: hello world');
  });

  it('finds matches in subdirectories', async () => {
    const result = await grepTool({ pattern: 'hello', path: fixturesDir });
    expect(result).toContain('sub/c.txt:1: hello from subdir');
  });

  it('filters by glob pattern', async () => {
    const result = await grepTool({ pattern: 'hello', glob: 'a.txt', path: fixturesDir });
    expect(result).toContain('a.txt');
    expect(result).not.toContain('sub/c.txt');
  });

  it('returns no-matches message when nothing found', async () => {
    const result = await grepTool({ pattern: 'zzznomatch', path: fixturesDir });
    expect(result).toBe('No matches found.');
  });

  it('supports regex patterns', async () => {
    const result = await grepTool({ pattern: 'fo+', path: fixturesDir });
    expect(result).toContain('foo');
  });
});
