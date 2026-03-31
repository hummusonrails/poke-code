import { describe, it, expect } from 'vitest';
import { mergeSettings, validateSettings, loadSettingsHierarchy, type SettingsSource } from '../../src/config/settings.js';

describe('mergeSettings', () => {
  it('merges multiple sources with later sources winning', () => {
    const base: SettingsSource = { source: 'default', settings: { permissionMode: 'default', theme: 'default' } };
    const project: SettingsSource = { source: 'project', settings: { theme: 'dark' } };
    const result = mergeSettings([base, project]);
    expect(result.permissionMode).toBe('default');
    expect(result.theme).toBe('dark');
  });

  it('returns defaults when no sources provided', () => {
    const result = mergeSettings([]);
    expect(result.permissionMode).toBe('default');
  });

  it('CLI flags override everything', () => {
    const base: SettingsSource = { source: 'default', settings: { permissionMode: 'default' } };
    const user: SettingsSource = { source: 'user', settings: { permissionMode: 'trusted' } };
    const cli: SettingsSource = { source: 'cli', settings: { permissionMode: 'readonly' } };
    const result = mergeSettings([base, user, cli]);
    expect(result.permissionMode).toBe('readonly');
  });
});

describe('validateSettings', () => {
  it('accepts valid settings', () => {
    const result = validateSettings({ permissionMode: 'trusted', theme: 'dark' });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid permissionMode', () => {
    const result = validateSettings({ permissionMode: 'yolo' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain('Invalid permissionMode: yolo');
    }
  });

  it('rejects invalid pollIntervalNormal', () => {
    const result = validateSettings({ pollIntervalNormal: -1 });
    expect(result.valid).toBe(false);
  });
});

describe('loadSettingsHierarchy', () => {
  it('loads from provided paths and merges', () => {
    const result = loadSettingsHierarchy({
      userConfigDir: '/nonexistent/path',
      projectDir: '/nonexistent/project',
      cliOverrides: { verbose: true } as any,
    });
    expect(result.permissionMode).toBe('default');
  });
});
