import { describe, it, expect, vi } from 'vitest';
import { webSearchTool } from '../../src/tools/web-search.js';

describe('webSearchTool', () => {
  it('returns formatted search results', async () => {
    const mockHtml = `<div class="result results_links results_links_deep web-result">
      <div class="links_main links_deep result__body">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage">Example Page</a>
        <a class="result__snippet">This is a test snippet about the page.</a>
      </div>
    </div>`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockHtml),
    }));

    const result = await webSearchTool({ query: 'test query' });
    expect(result).toContain('Example Page');
    expect(result).toContain('example.com');

    vi.unstubAllGlobals();
  });

  it('returns message when no results found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><body>No results</body></html>'),
    }));

    const result = await webSearchTool({ query: 'impossible query xyz' });
    expect(result).toContain('No results found');

    vi.unstubAllGlobals();
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    await expect(webSearchTool({ query: 'test' })).rejects.toThrow('Search failed');

    vi.unstubAllGlobals();
  });

  it('respects limit parameter', async () => {
    const makeBlock = (n: number) =>
      `<div class="result results_links results_links_deep web-result"><div class="inner">` +
      `<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F${n}">Result ${n}</a>` +
      `<a class="result__snippet">Snippet ${n}</a>` +
      `</div></div>`;

    const mockHtml = [1, 2, 3, 4, 5].map(makeBlock).join('\n');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockHtml),
    }));

    const result = await webSearchTool({ query: 'test', limit: 2 });
    expect(result).toContain('Result 1');
    expect(result).toContain('Result 2');
    expect(result).not.toContain('Result 3');

    vi.unstubAllGlobals();
  });
});
