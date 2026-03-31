import type { HookConfig } from '../hooks/hooks.js';

export interface PluginSkill {
  name: string;
  keywords: string[];
  content: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  source: 'builtin' | 'npm' | 'local';
  skills: PluginSkill[];
  hooks: HookConfig[];
}

export class PluginRegistry {
  private plugins = new Map<string, PluginManifest>();

  register(manifest: PluginManifest): void {
    if (!manifest.name || manifest.name.trim() === '') {
      throw new Error('Invalid plugin: name is required');
    }
    if (this.plugins.has(manifest.name)) {
      throw new Error(`Plugin "${manifest.name}" is already registered`);
    }
    this.plugins.set(manifest.name, manifest);
  }

  unregister(name: string): void {
    this.plugins.delete(name);
  }

  get(name: string): PluginManifest | undefined {
    return this.plugins.get(name);
  }

  list(): PluginManifest[] {
    return Array.from(this.plugins.values());
  }

  getAllSkills(): PluginSkill[] {
    const skills: PluginSkill[] = [];
    for (const plugin of this.plugins.values()) {
      skills.push(...plugin.skills);
    }
    return skills;
  }

  getAllHooks(): HookConfig[] {
    const hooks: HookConfig[] = [];
    for (const plugin of this.plugins.values()) {
      hooks.push(...plugin.hooks);
    }
    return hooks;
  }
}
