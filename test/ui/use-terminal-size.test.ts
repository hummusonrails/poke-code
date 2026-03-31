import { describe, it, expect } from 'vitest';
import { getTerminalSize, clampHeight, computeAppHeight } from '../../src/ui/use-terminal-size.js';

describe('getTerminalSize', () => {
  it('returns columns and rows', () => {
    const size = getTerminalSize();
    expect(size.columns).toBeGreaterThan(0);
    expect(size.rows).toBeGreaterThan(0);
  });
});

describe('clampHeight', () => {
  it('clamps to minimum', () => {
    expect(clampHeight(5, 10, 100)).toBe(10);
  });

  it('clamps to maximum', () => {
    expect(clampHeight(200, 10, 100)).toBe(100);
  });

  it('returns value within range', () => {
    expect(clampHeight(50, 10, 100)).toBe(50);
  });
});

describe('computeAppHeight', () => {
  it('uses 85% of terminal height', () => {
    expect(computeAppHeight(100)).toBe(85);
  });

  it('never goes below minimum', () => {
    expect(computeAppHeight(8)).toBe(10);
  });

  it('stays 2 rows below terminal', () => {
    expect(computeAppHeight(11)).toBe(10);
  });
});
