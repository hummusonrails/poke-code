import { describe, expect, it, vi } from "vitest";
import { createStore } from "../../src/state/store.js";

describe("createStore", () => {
  it("returns initial state", () => {
    const store = createStore();
    const state = store.getState();
    expect(state.permissionMode).toBe("default");
    expect(state.messages).toEqual([]);
    expect(state.waiting).toBe(false);
  });

  it("updates state immutably", () => {
    const store = createStore();
    const before = store.getState();
    store.setState({ waiting: true });
    const after = store.getState();
    expect(before.waiting).toBe(false);
    expect(after.waiting).toBe(true);
  });

  it("notifies subscribers on change", () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ waiting: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ waiting: true }));
  });

  it("unsubscribes correctly", () => {
    const store = createStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.setState({ waiting: true });
    expect(listener).not.toHaveBeenCalled();
  });

  it("supports functional updater", () => {
    const store = createStore();
    store.setState((prev) => ({ messageCount: prev.messageCount + 1 }));
    expect(store.getState().messageCount).toBe(1);
  });

  it("accepts initial overrides", () => {
    const store = createStore({ permissionMode: "trusted", verbose: true });
    expect(store.getState().permissionMode).toBe("trusted");
    expect(store.getState().verbose).toBe(true);
  });
});
