import type { AnimationState } from "./types.js";

type CompanionEventType = "tool_success" | "tool_failure" | "permission_denied" | "session_start" | "idle" | "level_up";

type CompanionEventListener = (animation: AnimationState, duration?: number) => void;

/** Map event types to animation states */
const EVENT_ANIMATIONS: Record<CompanionEventType, AnimationState> = {
  tool_success: "excited",
  tool_failure: "nervous",
  permission_denied: "startled",
  session_start: "excited",
  idle: "sleepy",
  level_up: "celebrating",
};

/** Default durations in ms */
const EVENT_DURATIONS: Record<CompanionEventType, number> = {
  tool_success: 2000,
  tool_failure: 3000,
  permission_denied: 2000,
  session_start: 3000,
  idle: 5000,
  level_up: 5000,
};

class CompanionEvents {
  private listeners: Set<CompanionEventListener> = new Set();

  on(listener: CompanionEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: CompanionEventType): void {
    const animation = EVENT_ANIMATIONS[event];
    const duration = EVENT_DURATIONS[event];
    for (const listener of this.listeners) {
      listener(animation, duration);
    }
  }
}

export const companionEvents = new CompanionEvents();
export type { CompanionEventType };
