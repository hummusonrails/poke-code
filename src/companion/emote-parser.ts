import type { AnimationState, ParsedEmote } from "./types.js";

/** Match [emote]...[/emote] blocks, including multi-line content */
const EMOTE_BLOCK = /\[emote\]([\s\S]*?)\[\/emote\]/gm;

/** Match double-quoted speech within an emote */
const SPEECH_REGEX = /"([^"]+)"/g;

/** Keyword groups mapped to animation states */
const KEYWORD_MAP: Array<[RegExp, AnimationState]> = [
  [/\b(?:excited|happy|wiggles?|sparks?|bounces?|glows?)\b/i, "excited"],
  [/\b(?:thinks?|ponders?|considers?|tilts?|hums?|muses?)\b/i, "thoughtful"],
  [/\b(?:nervous|worried|shivers?|trembles?|fidgets?)\b/i, "nervous"],
  [/\b(?:sleepy|yawns?|dozes?|drowsy|naps?)\b/i, "sleepy"],
  [/\b(?:celebrates?|cheers?|dances?|twirls?|confetti)\b/i, "celebrating"],
  [/\b(?:startled|jumps?|surprised|gasps?|blinks?)\b/i, "startled"],
];

/** Map an emote action to an animation state based on keyword matching */
export function actionToAnimation(action: string): AnimationState {
  for (const [pattern, state] of KEYWORD_MAP) {
    if (pattern.test(action)) return state;
  }
  return "idle";
}

/** Extract all [emote]...[/emote] blocks from text */
export function parseEmotes(text: string): ParsedEmote[] {
  const emotes: ParsedEmote[] = [];

  for (const match of text.matchAll(EMOTE_BLOCK)) {
    const raw = match[0];
    const inner = match[1].trim();

    // Extract quoted speech segments
    const speechMatches = [...inner.matchAll(SPEECH_REGEX)];
    const speech = speechMatches.length > 0 ? speechMatches.map((m) => m[1]).join(" ") : undefined;

    // Action is everything outside the quoted parts
    const action = inner.replace(SPEECH_REGEX, "").replace(/\s+/g, " ").trim();

    emotes.push({
      raw,
      action,
      speech,
      animation: actionToAnimation(action),
    });
  }

  return emotes;
}

/** Extract emote blocks and return cleaned text + emotes */
export function extractEmotes(text: string): { cleanText: string; emotes: ParsedEmote[] } {
  const emotes = parseEmotes(text);
  const cleanText = text
    .replace(EMOTE_BLOCK, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { cleanText, emotes };
}
