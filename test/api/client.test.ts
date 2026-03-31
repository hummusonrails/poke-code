import { beforeEach, describe, expect, it, vi } from "vitest";
import { PokeApiClient } from "../../src/api/client.js";

describe("PokeApiClient", () => {
  let client: PokeApiClient;

  beforeEach(() => {
    client = new PokeApiClient("test-api-key");
    // Mock backoff to avoid real delays in tests
    vi.spyOn(client as unknown as { backoff: () => Promise<void> }, "backoff").mockResolvedValue(undefined);
  });

  it("sends message with correct headers and body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, message: "Message sent successfully" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.sendMessage("hello poke");

    expect(mockFetch).toHaveBeenCalledWith("https://poke.com/api/v1/inbound/api-message", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-api-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "hello poke" }),
    });
    expect(result.success).toBe(true);

    vi.unstubAllGlobals();
  });

  it("throws on 401 unauthorized", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(client.sendMessage("test")).rejects.toThrow("Poke API error: 401 Unauthorized");

    vi.unstubAllGlobals();
  });

  it("throws on network error", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    await expect(client.sendMessage("test")).rejects.toThrow("Network error");

    vi.unstubAllGlobals();
  });

  it("constructs with api key", () => {
    expect(() => new PokeApiClient("")).toThrow("API key is required");
  });

  it("retries on 429 with exponential backoff", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, statusText: "Too Many Requests" })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, message: "ok" }) });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.sendMessage("test");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);

    vi.unstubAllGlobals();
  });

  it("retries on 500 server errors", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: "Internal Server Error" })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, message: "ok" }) });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.sendMessage("test");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);

    vi.unstubAllGlobals();
  });

  it("gives up after max retries on persistent 500", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" });
    vi.stubGlobal("fetch", mockFetch);

    await expect(client.sendMessage("test")).rejects.toThrow("Poke API error: 500 Internal Server Error");
    expect(mockFetch).toHaveBeenCalledTimes(3);

    vi.unstubAllGlobals();
  });

  it("retries on network errors then succeeds", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, message: "ok" }) });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.sendMessage("test");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);

    vi.unstubAllGlobals();
  });

  it("does not retry on 401 (not retryable)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: "Unauthorized" });
    vi.stubGlobal("fetch", mockFetch);

    await expect(client.sendMessage("test")).rejects.toThrow("Poke API error: 401 Unauthorized");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
