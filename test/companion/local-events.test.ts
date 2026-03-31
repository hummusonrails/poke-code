import { describe, expect, it } from "vitest";
import { companionEvents } from "../../src/companion/local-events.js";

describe("companionEvents", () => {
  it("on() returns an unsubscribe function", () => {
    const unsub = companionEvents.on(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });

  it("emit() calls all listeners with correct animation and duration", () => {
    const calls: Array<{ animation: string; duration?: number }> = [];
    const unsub = companionEvents.on((animation, duration) => {
      calls.push({ animation, duration });
    });

    companionEvents.emit("tool_success");
    expect(calls).toHaveLength(1);
    expect(calls[0].animation).toBe("excited");
    expect(calls[0].duration).toBe(2000);

    unsub();
  });

  it("unsubscribe function removes listener", () => {
    const calls: string[] = [];
    const unsub = companionEvents.on((animation) => {
      calls.push(animation);
    });

    companionEvents.emit("session_start");
    expect(calls).toHaveLength(1);

    unsub();
    companionEvents.emit("session_start");
    expect(calls).toHaveLength(1); // no additional call
  });

  it("multiple listeners all get called", () => {
    const callsA: string[] = [];
    const callsB: string[] = [];

    const unsubA = companionEvents.on((animation) => {
      callsA.push(animation);
    });
    const unsubB = companionEvents.on((animation) => {
      callsB.push(animation);
    });

    companionEvents.emit("level_up");
    expect(callsA).toHaveLength(1);
    expect(callsA[0]).toBe("celebrating");
    expect(callsB).toHaveLength(1);
    expect(callsB[0]).toBe("celebrating");

    unsubA();
    unsubB();
  });
});
