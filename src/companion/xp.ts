import type { Accessory, Stage, XPEvent } from "./types.js";
import { ACCESSORIES, ACCESSORY_THRESHOLDS, STAGE_THRESHOLDS, STAGES, XP_VALUES } from "./types.js";

/** Derive the current evolution stage from total XP. */
export function getStage(xp: number): Stage {
  let current: Stage = "spark";
  for (const stage of STAGES) {
    if (xp >= STAGE_THRESHOLDS[stage]) {
      current = stage;
    }
  }
  return current;
}

/** Derive all unlocked accessories from total XP. */
export function getUnlockedAccessories(xp: number): Accessory[] {
  return ACCESSORIES.filter((a) => xp >= ACCESSORY_THRESHOLDS[a]);
}

/** Pure function: grant XP for an event and compute what changed. */
export function grantXP(
  current: number,
  event: XPEvent,
): {
  xp: number;
  leveledUp: boolean;
  newStage?: Stage;
  newAccessories: Accessory[];
} {
  const prev = current;
  const next = prev + XP_VALUES[event];

  const prevStage = getStage(prev);
  const nextStage = getStage(next);
  const leveledUp = prevStage !== nextStage;

  const prevAccessories = new Set(getUnlockedAccessories(prev));
  const newAccessories = getUnlockedAccessories(next).filter((a) => !prevAccessories.has(a));

  return {
    xp: next,
    leveledUp,
    ...(leveledUp ? { newStage: nextStage } : {}),
    newAccessories,
  };
}

/** What's the next unlock (stage or accessory) and how much XP is needed? */
export function getNextMilestone(xp: number): { type: "stage" | "accessory"; name: string; xpNeeded: number } | null {
  let best: { type: "stage" | "accessory"; name: string; xpNeeded: number } | null = null;

  for (const stage of STAGES) {
    const threshold = STAGE_THRESHOLDS[stage];
    if (threshold > xp) {
      const xpNeeded = threshold - xp;
      if (!best || xpNeeded < best.xpNeeded) {
        best = { type: "stage", name: stage, xpNeeded };
      }
    }
  }

  for (const accessory of ACCESSORIES) {
    const threshold = ACCESSORY_THRESHOLDS[accessory];
    if (threshold > xp) {
      const xpNeeded = threshold - xp;
      if (!best || xpNeeded < best.xpNeeded) {
        best = { type: "accessory", name: accessory, xpNeeded };
      }
    }
  }

  return best;
}
