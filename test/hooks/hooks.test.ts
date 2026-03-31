import { describe, expect, it, vi } from "vitest";
import { HookRegistry } from "../../src/hooks/hooks.js";

describe("HookRegistry", () => {
  it("registers and fires hooks", async () => {
    const registry = new HookRegistry();
    const handler = vi.fn();
    registry.register({ event: "tool:after", command: "echo test", handler });
    await registry.fire({ type: "tool:after", toolName: "write_file", params: { path: "/foo" } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("fires only matching event hooks", async () => {
    const registry = new HookRegistry();
    const afterHandler = vi.fn();
    const beforeHandler = vi.fn();
    registry.register({ event: "tool:after", command: "echo after", handler: afterHandler });
    registry.register({ event: "tool:before", command: "echo before", handler: beforeHandler });
    await registry.fire({ type: "tool:after", toolName: "bash", params: {} });
    expect(afterHandler).toHaveBeenCalledTimes(1);
    expect(beforeHandler).not.toHaveBeenCalled();
  });

  it("supports tool name filtering", async () => {
    const registry = new HookRegistry();
    const handler = vi.fn();
    registry.register({ event: "tool:after", toolFilter: "write_file", command: "echo formatted", handler });
    await registry.fire({ type: "tool:after", toolName: "read_file", params: {} });
    expect(handler).not.toHaveBeenCalled();
    await registry.fire({ type: "tool:after", toolName: "write_file", params: { path: "/a" } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("continues even if a hook throws", async () => {
    const registry = new HookRegistry();
    const failHandler = vi.fn().mockRejectedValue(new Error("boom"));
    const okHandler = vi.fn();
    registry.register({ event: "tool:after", command: "fail", handler: failHandler });
    registry.register({ event: "tool:after", command: "ok", handler: okHandler });
    await registry.fire({ type: "tool:after", toolName: "bash", params: {} });
    expect(failHandler).toHaveBeenCalled();
    expect(okHandler).toHaveBeenCalled();
  });

  it("unregisters hooks", async () => {
    const registry = new HookRegistry();
    const handler = vi.fn();
    const id = registry.register({ event: "tool:after", command: "echo x", handler });
    registry.unregister(id);
    await registry.fire({ type: "tool:after", toolName: "bash", params: {} });
    expect(handler).not.toHaveBeenCalled();
  });

  it("loads hooks from config format", () => {
    const config = [{ event: "tool:after" as const, toolFilter: "write_file", command: "prettier --write $PATH" }];
    const registry = HookRegistry.fromConfig(config);
    expect(registry.listHooks()).toHaveLength(1);
    expect(registry.listHooks()[0].event).toBe("tool:after");
  });
});
