import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PokeConfig } from "../types.js";
import { DEFAULT_CONFIG } from "../types.js";

export interface SettingsSource {
  source: "default" | "user" | "project" | "env" | "cli";
  settings: Partial<PokeConfig>;
}

type ValidationResult = { valid: true } | { valid: false; errors: string[] };

const VALID_MODES = new Set(["default", "trusted", "readonly"]);

export function validateSettings(partial: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  if (partial.permissionMode !== undefined && !VALID_MODES.has(partial.permissionMode as string)) {
    errors.push(`Invalid permissionMode: ${partial.permissionMode}`);
  }
  if (partial.theme !== undefined && typeof partial.theme !== "string") {
    errors.push("Invalid theme: must be a string");
  }
  if (partial.pollIntervalNormal !== undefined) {
    const val = partial.pollIntervalNormal as number;
    if (typeof val !== "number" || val < 0) {
      errors.push("Invalid pollIntervalNormal: must be a positive number");
    }
  }
  if (partial.pollIntervalFast !== undefined) {
    const val = partial.pollIntervalFast as number;
    if (typeof val !== "number" || val < 0) {
      errors.push("Invalid pollIntervalFast: must be a positive number");
    }
  }
  if (partial.vimMode !== undefined && typeof partial.vimMode !== "boolean") {
    errors.push("Invalid vimMode: must be a boolean");
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

export function mergeSettings(sources: SettingsSource[]): PokeConfig {
  let merged: PokeConfig = { ...DEFAULT_CONFIG };
  for (const source of sources) {
    merged = { ...merged, ...source.settings };
  }
  return merged;
}

function loadJsonFile(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

export interface SettingsLoadOptions {
  userConfigDir: string;
  projectDir: string;
  cliOverrides?: Partial<PokeConfig>;
}

export function loadSettingsHierarchy(opts: SettingsLoadOptions): PokeConfig {
  const sources: SettingsSource[] = [{ source: "default", settings: { ...DEFAULT_CONFIG } }];

  // User-level settings: ~/.poke/settings.json
  const userSettings = loadJsonFile(join(opts.userConfigDir, "settings.json"));
  if (userSettings) {
    sources.push({ source: "user", settings: userSettings as Partial<PokeConfig> });
  }

  // Project-level settings: .poke/settings.json
  const projectSettings = loadJsonFile(join(opts.projectDir, ".poke", "settings.json"));
  if (projectSettings) {
    sources.push({ source: "project", settings: projectSettings as Partial<PokeConfig> });
  }

  // Environment variables
  const envOverrides: Partial<PokeConfig> = {};
  if (process.env.POKE_PERMISSION_MODE && VALID_MODES.has(process.env.POKE_PERMISSION_MODE)) {
    envOverrides.permissionMode = process.env.POKE_PERMISSION_MODE as PokeConfig["permissionMode"];
  }
  if (Object.keys(envOverrides).length > 0) {
    sources.push({ source: "env", settings: envOverrides });
  }

  // CLI flags (highest priority)
  if (opts.cliOverrides && Object.keys(opts.cliOverrides).length > 0) {
    sources.push({ source: "cli", settings: opts.cliOverrides });
  }

  return mergeSettings(sources);
}
