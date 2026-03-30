import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { globTool } from '../../src/tools/glob.js';

const fixturesDir = join(import.meta.dirname, '__fixtures__', 'glob');

beforeAll(() => {
  mkdirSync(join(fixturesDir, 'sub'), { recursive: true });
  writeFileSync(join(fixturesDir, 'alpha.ts'), '');
  writeFileSync(join(fixturesDir, 'beta.ts'), '');
  writeFileSync(join(fixturesDir, 'gamma.js'), '');
  writeFileSync(join(fixturesDir, 'sub', 'delta.ts'), '');
});

afterAll(() => {
  rmSync(fixturesDir, { recursive: true, force: true });
});

describe('globTool', () => {
  it('finds files matching a pattern', async () => {
    const result = await globTool({ pattern: '*.ts', path: fixturesDir });
    const files = result.split('\n');
    expect(files).toContain('alpha.ts');
    expect(files).toContain('beta.ts');
    expect(files).not.toContain('gamma.js');
  });

  it('finds files recursively with wildcard', async () => {
    const result = await globTool({ pattern: '**/*.ts', path: fixturesDir });
    const files = result.split('\n');
    expect(files.some(f => f.includes('delta.ts'))).toBe(true);
  });

  it('returns no-match message when nothing matches', async () => {
    const result = await globTool({ pattern: '*.rb', path: fixturesDir });
    expect(result).toBe('No files matched the pattern.');
  });

  it('returns sorted results', async () => {
    const result = await globTool({ pattern: '*.ts', path: fixturesDir });
    const files = result.split('\n');
    expect(files).toEqual([...files].sort());
  });
});
