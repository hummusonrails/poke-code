// Evolution stages (not rarity — progression based)
export const STAGES = ["spark", "powered", "overclocked"] as const;
export type Stage = (typeof STAGES)[number];

// 10 island-tech hybrid species
export const SPECIES = [
  "clicklaw", // hermit crab with antenna shell
  "synthray", // manta ray of translucent PCB
  "drifter", // jellyfish trailing fiber optic tendrils
  "shellbyte", // sea turtle with circuit-board carapace
  "flickbug", // firefly with blinking LED abdomen
  "reefnode", // coral polyp cluster as server rack
  "zapgecko", // gecko with glowing circuit-trace stripes
  "coilpod", // coconut octopus with copper-wire tentacles
  "wattpalm", // palm tree sprite with LED fronds
  "neoncoil", // electric eel wrapped in copper
] as const;
export type Species = (typeof SPECIES)[number];

// Eye characters
export const EYES = ["·", "✦", "◉", "@", "°", "×"] as const;
export type Eye = (typeof EYES)[number];

// Accessories unlocked by XP thresholds
export const ACCESSORIES = [
  "signal-spark", // XP 20 — tiny spark particle above head
  "coral-crown", // XP 50 — small hat
  "tide-trail", // XP 150 — wave follows behind
  "solar-shell", // XP 250 — shell/panel on back
  "copper-coil", // XP 400 — decorative wire wrap
  "biolume-glow", // XP 600 — color shifts on idle
  "storm-aura", // XP 1000 — lightning crackle particles
] as const;
export type Accessory = (typeof ACCESSORIES)[number];

export const ACCESSORY_THRESHOLDS: Record<Accessory, number> = {
  "signal-spark": 20,
  "coral-crown": 50,
  "tide-trail": 150,
  "solar-shell": 250,
  "copper-coil": 400,
  "biolume-glow": 600,
  "storm-aura": 1000,
};

export const STAGE_THRESHOLDS: Record<Stage, number> = {
  spark: 0,
  powered: 100,
  overclocked: 500,
};

// Deterministic from hash(userId) — never persisted
export interface CompanionBones {
  species: Species;
  eye: Eye;
}

// User-chosen/generated — persisted in config
export interface CompanionSoul {
  name: string;
  personality: string;
}

// Full companion = bones + soul + progression
export interface Companion extends CompanionBones, CompanionSoul {
  xp: number;
  stage: Stage;
  accessories: Accessory[];
  muted: boolean;
}

// What gets stored in config (bones are NOT stored)
export interface StoredCompanion {
  name: string;
  personality: string;
  xp: number;
  accessories: Accessory[];
  muted: boolean;
}

// XP event types
export type XPEvent =
  | "session_start"
  | "message_sent"
  | "tool_executed"
  | "cron_completed"
  | "dream_consolidation"
  | "long_session";

export const XP_VALUES: Record<XPEvent, number> = {
  session_start: 5,
  message_sent: 1,
  tool_executed: 2,
  cron_completed: 3,
  dream_consolidation: 10,
  long_session: 5,
};

// Emote parsed from [emote]...[/emote] tags
export interface ParsedEmote {
  raw: string;
  action: string;
  speech?: string;
  animation: AnimationState;
}

// Animation states driven by emote actions or local events
export type AnimationState = "idle" | "excited" | "thoughtful" | "nervous" | "sleepy" | "celebrating" | "startled";
