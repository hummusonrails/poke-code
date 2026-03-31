import React, { useState, useEffect, useRef } from "react";
import { Box, Text } from "ink";
import type { Companion, AnimationState } from "./types.js";
import { renderSprite, renderFace, spriteFrameCount } from "./sprites.js";
import { getTheme } from "../ui/theme.js";

const TICK_MS = 500;
const BUBBLE_SHOW = 20; // ticks -> 10s
const FADE_WINDOW = 6; // last 3s dims
const MIN_COLS_FOR_FULL_SPRITE = 100;
const IDLE_SEQUENCE = [0, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 2, 0, 0, 0];
const BUBBLE_MAX_WIDTH = 30;

interface SpeechBubbleProps {
  text: string;
  fading: boolean;
}

function SpeechBubble({ text, fading }: SpeechBubbleProps) {
  const theme = getTheme("auto");

  // Word-wrap text at BUBBLE_MAX_WIDTH
  const lines: string[] = [];
  const words = text.split(" ");
  let current = "";
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= BUBBLE_MAX_WIDTH) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="column"
    >
      {lines.map((line, i) => (
        <Text key={i} italic dimColor={fading}>
          {line}
        </Text>
      ))}
    </Box>
  );
}

interface CompanionSpriteProps {
  companion: Companion;
  reaction?: { speech?: string; animation: AnimationState };
  terminalWidth: number;
}

export function CompanionSprite({ companion, reaction, terminalWidth }: CompanionSpriteProps) {
  const [tick, setTick] = useState(0);
  const [speechTick, setSpeechTick] = useState(0);
  const [visibleSpeech, setVisibleSpeech] = useState<string | undefined>(undefined);
  const prevSpeechRef = useRef<string | undefined>(undefined);
  const theme = getTheme("auto");

  // Animation tick
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
      setSpeechTick((prev) => prev + 1);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Reset speech timer when reaction.speech changes
  useEffect(() => {
    const newSpeech = reaction?.speech;
    if (newSpeech && newSpeech !== prevSpeechRef.current) {
      setVisibleSpeech(newSpeech);
      setSpeechTick(0);
    }
    prevSpeechRef.current = newSpeech;
  }, [reaction?.speech]);

  // Clear speech after BUBBLE_SHOW ticks
  useEffect(() => {
    if (visibleSpeech && speechTick >= BUBBLE_SHOW) {
      setVisibleSpeech(undefined);
    }
  }, [speechTick, visibleSpeech]);

  const isWide = terminalWidth >= MIN_COLS_FOR_FULL_SPRITE;
  const isReacting = reaction && reaction.animation !== "idle";
  const frameCount = spriteFrameCount(companion.species, companion.stage);
  const speaking = visibleSpeech != null;
  const fading = speaking && speechTick >= BUBBLE_SHOW - FADE_WINDOW;

  // Determine sprite frame
  let frame: number;
  if (isReacting) {
    // Cycle all frames fast during reaction
    frame = tick % frameCount;
  } else {
    // Idle sequence
    const seqIdx = tick % IDLE_SEQUENCE.length;
    const seqVal = IDLE_SEQUENCE[seqIdx];
    if (seqVal === -1) {
      // Blink frame uses frame 0 but eyes will be replaced below
      frame = 0;
    } else {
      frame = Math.min(seqVal, frameCount - 1);
    }
  }

  // Narrow terminal: inline face + name + quip
  if (!isWide) {
    const face = renderFace(companion.species, companion.eye);
    const blinking = !isReacting && IDLE_SEQUENCE[tick % IDLE_SEQUENCE.length] === -1;
    const displayFace = blinking ? face.replace(/[^\s()[\]{}<>~^|*/\\=_,.>!@#$%&+;:'"?-]/g, (ch) => {
      // Replace eye characters with blink
      if (ch === companion.eye) return "-";
      return ch;
    }) : face;

    // Truncate quip for narrow terminals
    const maxQuipLen = Math.max(0, terminalWidth - displayFace.length - companion.name.length - 4);
    const quip = visibleSpeech
      ? visibleSpeech.length > maxQuipLen
        ? visibleSpeech.slice(0, maxQuipLen - 1) + "\u2026"
        : visibleSpeech
      : undefined;

    return (
      <Box gap={1}>
        <Text color={theme.primary}>{displayFace}</Text>
        <Text color={theme.primary} bold>{companion.name}</Text>
        {quip && (
          <Text italic dimColor={fading}>{quip}</Text>
        )}
      </Box>
    );
  }

  // Wide terminal: full sprite with optional speech bubble
  const spriteLines = renderSprite(
    companion.species,
    companion.stage,
    companion.eye,
    frame,
    companion.accessories,
  );

  // Handle blink: replace eye chars with "-" on blink frames
  const blinking = !isReacting && IDLE_SEQUENCE[tick % IDLE_SEQUENCE.length] === -1;
  const displayLines = blinking
    ? spriteLines.map((line) => line.replaceAll(companion.eye, "-"))
    : spriteLines;

  return (
    <Box flexDirection="column" alignItems="center">
      {speaking && visibleSpeech && (
        <SpeechBubble text={visibleSpeech} fading={fading} />
      )}
      <Box flexDirection="column">
        {displayLines.map((line, i) => (
          <Text key={i} color={theme.primary}>
            {line}
          </Text>
        ))}
      </Box>
      <Text color={theme.primary} bold>
        {companion.name}
      </Text>
    </Box>
  );
}

/**
 * Returns how many columns the companion sprite occupies so the input area
 * can adjust its width. Returns 0 for narrow terminals or no companion.
 */
export function companionReservedColumns(
  terminalWidth: number,
  companion: Companion | undefined,
  speaking: boolean,
): number {
  if (!companion || terminalWidth < MIN_COLS_FOR_FULL_SPRITE) {
    return 0;
  }
  // Sprite lines are 12 chars wide; speech bubble adds ~34 (30 + padding + border)
  const spriteWidth = 14;
  const bubbleWidth = speaking ? BUBBLE_MAX_WIDTH + 4 : 0;
  return Math.max(spriteWidth, bubbleWidth) + 2; // +2 for gap
}
