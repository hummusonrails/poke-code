import { describe, it, expect } from 'vitest';
import { PluginRegistry, type PluginManifest } from '../../src/plugins/registry.js';

const testPlugin: PluginManifest = {
  name: 'test-plugin',
  version: '1.0.0',
  description: 'A test plugin',
  source: 'builtin',
  skills: [{ name: 'test-skill', keywords: ['test'], content: 'Do the test thing' }],
  hooks: [{ event: 'tool:after', toolFilter: 'write_file', command: 'echo formatted' }],
};

const anotherPlugin: PluginManifest = {
  name: 'another-plugin',
  version: '2.0.0',
  description: 'Another test plugin',
  source: 'npm',
  skills: [],
  hooks: [],
};

describe('PluginRegistry', () => {
  it('registers and retrieves plugins', () => {
    const registry = new PluginRegistry();
    registry.register(testPlugin);
    expect(registry.get('test-plugin')).toEqual(testPlugin);
  });

  it('lists all registered plugins', () => {
    const registry = new PluginRegistry();
    registry.register(testPlugin);
    registry.register(anotherPlugin);
    expect(registry.list()).toHaveLength(2);
  });

  it('prevents duplicate registration', () => {
    const registry = new PluginRegistry();
    registry.register(testPlugin);
    expect(() => registry.register(testPlugin)).toThrow('already registered');
  });

  it('unregisters plugins', () => {
    const registry = new PluginRegistry();
    registry.register(testPlugin);
    registry.unregister('test-plugin');
    expect(registry.get('test-plugin')).toBeUndefined();
  });

  it('collects skills from all plugins', () => {
    const registry = new PluginRegistry();
    registry.register(testPlugin);
    registry.register(anotherPlugin);
    const skills = registry.getAllSkills();
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('test-skill');
  });

  it('collects hooks from all plugins', () => {
    const registry = new PluginRegistry();
    registry.register(testPlugin);
    const hooks = registry.getAllHooks();
    expect(hooks).toHaveLength(1);
    expect(hooks[0].event).toBe('tool:after');
  });

  it('validates plugin manifest', () => {
    const registry = new PluginRegistry();
    const invalid = { name: '', version: '1.0.0', description: '', source: 'builtin', skills: [], hooks: [] } as PluginManifest;
    expect(() => registry.register(invalid)).toThrow('Invalid plugin');
  });
});
