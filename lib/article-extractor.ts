import * as cheerio from "cheerio";

export async function fetchArticleText(url: string): Promise<{ title: string; content: string }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LinkedInFeedAI/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove script/style/nav/footer tags
  $("script, style, nav, footer, header, aside, iframe, noscript").remove();

  // Try to find the main content
  const title = $("title").text().trim() || $("h1").first().text().trim() || "Untitled";
  
  // Look for article content in common containers
  const selectors = [
    "article",
    "[role='main']",
    "main",
    ".article-content",
    ".post-content",
    ".entry-content",
    ".content",
    "#content",
    ".blog-post",
  ];

  let content = "";
  for (const selector of selectors) {
    const element = $(selector);
    if (element.length > 0) {
      content = element.text();
      break;
    }
  }

  // Fallback to all paragraphs if no content found
  if (!content.trim()) {
    content = $("p")
      .map((_, el) => $(el).text())
      .get()
      .join("\n\n");
  }

  // Clean up whitespace
  content = content
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();

  return { title, content };
}
