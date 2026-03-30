export async function webSearchTool(params: { query: string; limit?: number }): Promise<string> {
  const { query, limit = 5 } = params;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  if (!response.ok) throw new Error(`Search failed: ${response.status}`);

  const html = await response.text();

  const results: Array<{ title: string; url: string; snippet: string }> = [];

  // Match result blocks - each result has class="result results_links"
  const resultBlocks = html.match(/<div class="result results_links[\s\S]*?<\/div>\s*<\/div>/g) ?? [];

  for (const block of resultBlocks.slice(0, limit)) {
    const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/);
    const urlMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]*?)"/);
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

    if (titleMatch && urlMatch) {
      const title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
      let resultUrl = urlMatch[1];
      // DuckDuckGo wraps URLs in a redirect - extract the actual URL
      const uddgMatch = resultUrl.match(/uddg=([^&]*)/);
      if (uddgMatch) resultUrl = decodeURIComponent(uddgMatch[1]);
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';

      results.push({ title, url: resultUrl, snippet });
    }
  }

  if (results.length === 0) {
    return `No results found for: ${query}`;
  }

  return results
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
    .join('\n\n');
}
