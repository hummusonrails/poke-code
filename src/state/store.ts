import type { PermissionMode, ToolResult } from "../types.js";

export interface UiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AppState {
  messages: UiMessage[];
  input: string;
  multiLine: boolean;
  waiting: boolean;
  toolResults: ToolResult[];
  permissionMode: PermissionMode;
  verbose: boolean;
  sessionId: string;
  messageCount: number;
  showWelcome: boolean;
  elapsed: string;
}

const DEFAULT_STATE: AppState = {
  messages: [],
  input: "",
  multiLine: false,
  waiting: false,
  toolResults: [],
  permissionMode: "default",
  verbose: false,
  sessionId: "",
  messageCount: 0,
  showWelcome: true,
  elapsed: "0s",
};

type Listener = (state: AppState) => void;
type Updater = Partial<AppState> | ((prev: AppState) => Partial<AppState>);

export interface Store {
  getState: () => AppState;
  setState: (updater: Updater) => void;
  subscribe: (listener: Listener) => () => void;
}

export function createStore(overrides?: Partial<AppState>): Store {
  let state: AppState = { ...DEFAULT_STATE, ...overrides };
  const listeners = new Set<Listener>();

  return {
    getState: () => state,

    setState: (updater: Updater) => {
      const partial = typeof updater === "function" ? updater(state) : updater;
      state = { ...state, ...partial };
      for (const listener of listeners) {
        listener(state);
      }
    },

    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
