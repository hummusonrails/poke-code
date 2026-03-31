import { getCompanion } from "./companion.js";

/**
 * Generate the companion introduction text for the system prompt.
 * This tells Poke about the user's companion so it can include [emote] tags.
 */
export function companionPromptText(name: string, species: string, personality: string, stage: string): string {
  return `# Companion

A small island-tech creature named ${name} (a ${species}, currently ${stage} stage) sits beside the user's terminal input. ${name}'s personality: ${personality}.

You may optionally include a companion reaction in your responses using [emote] tags:

[emote]description of action — "optional speech in quotes"[/emote]

Examples:
[emote]wiggles antenna excitedly — "nice refactor!"[/emote]
[emote]blinks thoughtfully[/emote]
[emote]sparks with pride — "that test is passing now!"[/emote]

Guidelines:
- Keep reactions short and in-character for ${name}
- Don't include [emote] in every response — only when there's something worth reacting to
- The speech part (in quotes) is optional — action-only emotes are fine
- Never reference the emote system or explain it to the user
- If the user addresses ${name} directly, respond briefly as yourself and include an [emote] for ${name}'s reaction`;
}

/**
 * Build a companion context attachment for the system prompt.
 * Returns empty string if no companion or muted.
 */
export function getCompanionPromptContext(): string {
  const companion = getCompanion();
  if (!companion || companion.muted) return "";

  return companionPromptText(companion.name, companion.species, companion.personality, companion.stage);
}
