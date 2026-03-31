import { describe, it, expect } from 'vitest';
import { getTheme, resolveThemeColor, type ThemeName } from '../../src/ui/theme.js';

describe('getTheme', () => {
  it('returns dark theme by default', () => {
    const theme = getTheme('dark');
    expect(theme.text).toBe('#d0dcea');
    expect(theme.primary).toBe('#4a7cc9');
    expect(theme.error).toBe('#e05252');
  });

  it('returns light theme', () => {
    const theme = getTheme('light');
    expect(theme.text).toBe('#1a2744');
    expect(theme.primary).toBe('#2d5aa0');
    expect(theme.background).toBe('#f5f7fa');
  });

  it('returns daltonized dark theme', () => {
    const theme = getTheme('dark-daltonized');
    expect(theme.diffAdded).not.toBe(getTheme('dark').diffAdded);
  });

  it('returns ansi theme for limited terminals', () => {
    const theme = getTheme('ansi');
    expect(theme.primary).toBe('blue');
    expect(theme.error).toBe('red');
  });

  it('falls back to dark for unknown theme', () => {
    const theme = getTheme('nonexistent' as ThemeName);
    expect(theme).toEqual(getTheme('dark'));
  });
});

describe('resolveThemeColor', () => {
  it('resolves theme keys', () => {
    const theme = getTheme('dark');
    expect(resolveThemeColor('primary', theme)).toBe('#4a7cc9');
  });

  it('passes through raw hex colors', () => {
    const theme = getTheme('dark');
    expect(resolveThemeColor('#ff0000', theme)).toBe('#ff0000');
  });
});
