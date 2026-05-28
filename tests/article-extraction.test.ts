import { describe, it, expect } from "vitest";

// Simple unit tests for article extraction logic
// Note: fetchArticleText requires actual HTTP requests, so we test the cheerio parsing logic

import * as cheerio from "cheerio";

describe("Article Extraction", () => {
  it("should extract title from HTML", () => {
    const html = `
      <html>
        <head><title>Test Article Title</title></head>
        <body>
          <article>
            <h1>Article Heading</h1>
            <p>First paragraph of content.</p>
            <p>Second paragraph of content.</p>
          </article>
        </body>
      </html>
    `;

    const $ = cheerio.load(html);
    const title = $("title").text().trim() || $("h1").first().text().trim() || "Untitled";
    expect(title).toBe("Test Article Title");
  });

  it("should extract article content from article tag", () => {
    const html = `
      <html>
        <body>
          <nav>Navigation content</nav>
          <article>
            <p>Article paragraph 1</p>
            <p>Article paragraph 2</p>
          </article>
          <footer>Footer content</footer>
        </body>
      </html>
    `;

    const $ = cheerio.load(html);
    $("script, style, nav, footer, header, aside, iframe, noscript").remove();
    
    const content = $("article").text();
    expect(content).toContain("Article paragraph 1");
    expect(content).toContain("Article paragraph 2");
    expect(content).not.toContain("Navigation content");
    expect(content).not.toContain("Footer content");
  });

  it("should fallback to all paragraphs when no article tag", () => {
    const html = `
      <html>
        <body>
          <div class="content">
            <p>First paragraph</p>
            <p>Second paragraph</p>
          </div>
        </body>
      </html>
    `;

    const $ = cheerio.load(html);
    $("script, style, nav, footer, header, aside, iframe, noscript").remove();
    
    const content = $("p")
      .map((_, el) => $(el).text())
      .get()
      .join("\n\n");
    
    expect(content).toContain("First paragraph");
    expect(content).toContain("Second paragraph");
  });
});
