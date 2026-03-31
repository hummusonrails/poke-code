import { describe, it, expect } from 'vitest';
import { formatDuration, getThinkingTip } from '../../src/ui/spinner.js';

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(5000)).toBe('5s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(65000)).toBe('1m 5s');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0s');
  });
});

describe('getThinkingTip', () => {
  it('returns a string', () => {
    const tip = getThinkingTip();
    expect(typeof tip).toBe('string');
    expect(tip.length).toBeGreaterThan(0);
  });
});
