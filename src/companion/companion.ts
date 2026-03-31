import { homedir } from "node:os";
import { join } from "node:path";
import { ConfigStore } from "../config/store.js";
import type { Companion, StoredCompanion } from "./types.js";
import { roll } from "./roll.js";
import { getStage, getUnlockedAccessories } from "./xp.js";

function getStore(): ConfigStore {
  return new ConfigStore(join(homedir(), ".poke"));
}

/**
 * Get the full companion (bones + soul + progression) for the current user.
 * Returns undefined if no companion has been hatched yet (no soul in config).
 * Bones are regenerated from hash(userId) — never read from config.
 */
export function getCompanion(): Companion | undefined {
  const store = getStore();
  const config = store.load();
  if (!config.userId || !config.companion) return undefined;

  const { bones } = roll(config.userId);
  const stored = config.companion;

  return {
    ...bones,
    name: stored.name,
    personality: stored.personality,
    xp: stored.xp,
    stage: getStage(stored.xp),
    accessories: getUnlockedAccessories(stored.xp),
    muted: stored.muted,
  };
}

/**
 * Get the userId from config, generating and persisting one if missing.
 */
export function getOrCreateUserId(): string {
  const store = getStore();
  const config = store.load();
  if (config.userId) return config.userId;

  const userId = crypto.randomUUID();
  store.update({ userId });
  return userId;
}

/**
 * Hatch a new companion — store the soul in config.
 * Bones are NOT stored (regenerated from userId hash every time).
 */
export function hatchCompanion(name: string, personality: string): Companion {
  const userId = getOrCreateUserId();
  const { bones } = roll(userId);

  const stored: StoredCompanion = {
    name,
    personality,
    xp: 0,
    accessories: [],
    muted: false,
  };

  const store = getStore();
  store.update({ companion: stored });

  return {
    ...bones,
    name: stored.name,
    personality: stored.personality,
    xp: stored.xp,
    stage: getStage(stored.xp),
    accessories: stored.accessories,
    muted: stored.muted,
  };
}

/**
 * Update companion XP in config and return the updated companion.
 */
export function updateCompanionXP(xpDelta: number): Companion | undefined {
  const store = getStore();
  const config = store.load();
  if (!config.userId || !config.companion) return undefined;

  const newXp = config.companion.xp + xpDelta;
  const updated: StoredCompanion = {
    ...config.companion,
    xp: newXp,
    accessories: getUnlockedAccessories(newXp),
  };

  store.update({ companion: updated });

  const { bones } = roll(config.userId);
  return {
    ...bones,
    name: updated.name,
    personality: updated.personality,
    xp: updated.xp,
    stage: getStage(updated.xp),
    accessories: updated.accessories,
    muted: updated.muted,
  };
}

/**
 * Set companion muted state.
 */
export function setCompanionMuted(muted: boolean): void {
  const store = getStore();
  const config = store.load();
  if (!config.companion) return;

  store.update({ companion: { ...config.companion, muted } });
}

/**
 * Rename the companion.
 */
export function renameCompanion(name: string): void {
  const store = getStore();
  const config = store.load();
  if (!config.companion) return;

  store.update({ companion: { ...config.companion, name } });
}
