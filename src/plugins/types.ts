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
