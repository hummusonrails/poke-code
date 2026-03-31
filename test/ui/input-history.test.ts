import { describe, expect, it } from "vitest";
import { InputHistory } from "../../src/ui/input-history.js";

describe("InputHistory", () => {
  it("stores and retrieves entries", () => {
    const history = new InputHistory();
    history.push("first");
    history.push("second");
    expect(history.size()).toBe(2);
  });

  it("navigates up through history", () => {
    const history = new InputHistory();
    history.push("first");
    history.push("second");
    history.push("third");
    expect(history.up()).toBe("third");
    expect(history.up()).toBe("second");
    expect(history.up()).toBe("first");
    expect(history.up()).toBe("first");
  });

  it("navigates down through history", () => {
    const history = new InputHistory();
    history.push("first");
    history.push("second");
    history.up();
    history.up();
    expect(history.down()).toBe("second");
    expect(history.down()).toBe("");
  });

  it("resets cursor on push", () => {
    const history = new InputHistory();
    history.push("first");
    history.push("second");
    history.up();
    history.push("third");
    expect(history.up()).toBe("third");
  });

  it("deduplicates consecutive entries", () => {
    const history = new InputHistory();
    history.push("same");
    history.push("same");
    expect(history.size()).toBe(1);
  });

  it("respects max size", () => {
    const history = new InputHistory(3);
    history.push("a");
    history.push("b");
    history.push("c");
    history.push("d");
    expect(history.size()).toBe(3);
    expect(history.up()).toBe("d");
    expect(history.up()).toBe("c");
    expect(history.up()).toBe("b");
  });

  it("filters by prefix", () => {
    const history = new InputHistory();
    history.push("/help");
    history.push("fix the bug");
    history.push("/status");
    history.push("add feature");
    const matches = history.search("/");
    expect(matches).toEqual(["/status", "/help"]);
  });
});
