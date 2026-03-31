import { describe, expect, it, vi } from "vitest";
import { webFetchTool } from "../../src/tools/web-fetch.js";

describe("webFetchTool", () => {
  it("strips HTML and returns text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "text/html" },
        text: () => Promise.resolve("<html><body><h1>Hello</h1><p>World</p></body></html>"),
      }),
    );

    const result = await webFetchTool({ url: "https://example.com" });
    expect(result).toContain("Hello");
    expect(result).toContain("World");
    expect(result).not.toContain("<h1>");

    vi.unstubAllGlobals();
  });

  it("returns JSON as formatted string", async () => {
    const mockHeaders = new Map([["content-type", "application/json"]]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: (k: string) => mockHeaders.get(k) ?? null },
        json: () => Promise.resolve({ name: "test", version: "1.0" }),
      }),
    );

    const result = await webFetchTool({ url: "https://api.example.com/data" });
    expect(result).toContain('"name": "test"');

    vi.unstubAllGlobals();
  });

  it("truncates long content", async () => {
    const longText = "x".repeat(20000);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "text/html" },
        text: () => Promise.resolve(longText),
      }),
    );

    const result = await webFetchTool({ url: "https://example.com", maxLength: 100 });
    expect(result.length).toBeLessThanOrEqual(120); // 100 + "... (truncated)"
    expect(result).toContain("truncated");

    vi.unstubAllGlobals();
  });

  it("rejects non-HTTP URLs", async () => {
    await expect(webFetchTool({ url: "ftp://example.com" })).rejects.toThrow("must start with http");
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      }),
    );

    await expect(webFetchTool({ url: "https://example.com/nope" })).rejects.toThrow("Fetch failed: 404");

    vi.unstubAllGlobals();
  });

  it("strips scripts and styles from HTML", async () => {
    const html = `<html>
      <head><style>body { color: red; }</style></head>
      <body>
        <script>alert('xss')</script>
        <p>Clean content here</p>
      </body>
    </html>`;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "text/html" },
        text: () => Promise.resolve(html),
      }),
    );

    const result = await webFetchTool({ url: "https://example.com" });
    expect(result).toContain("Clean content here");
    expect(result).not.toContain("alert");
    expect(result).not.toContain("color: red");

    vi.unstubAllGlobals();
  });
});
