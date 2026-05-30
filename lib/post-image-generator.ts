import { chromium } from "playwright";

export interface PostImageOptions {
  title: string;
  content: string;
  authorName?: string;
}

/**
 * Generate a branded black & white image with the post text rendered on it.
 * Uses Playwright to screenshot a styled HTML page.
 * Output: 1200x627 PNG (LinkedIn optimal image size).
 */
export async function generatePostImage(
  options: PostImageOptions
): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 627 },
      deviceScaleFactor: 2,
    });

    const html = buildImageHtml(options);
    await page.setContent(html, { waitUntil: "networkidle" });

    // Wait for fonts to load
    await page.waitForTimeout(800);

    const screenshot = await page.screenshot({
      type: "png",
      fullPage: false,
    });

    return screenshot;
  } finally {
    await browser.close();
  }
}

function buildImageHtml({ title, content, authorName }: PostImageOptions): string {
  // Clean up content for display: limit length, strip markdown remnants
  const cleanContent = content
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .slice(0, 600); // Limit to fit visually

  const lines = cleanContent.split("\n").filter((l) => l.trim().length > 0);
  const displayLines = lines.slice(0, 5); // Show first 5 non-empty lines
  const hasMore = lines.length > 5;

  const bodyText = displayLines
    .map((line) => `<p class="post-line">${escapeHtml(line)}</p>`)
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      width: 1200px;
      height: 627px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #000000;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 70px 90px;
      position: relative;
      overflow: hidden;
    }
    
    /* White top border */
    .accent-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: #ffffff;
    }
    
    /* Subtle grain texture overlay */
    body::before {
      content: '';
      position: absolute;
      inset: 0;
      opacity: 0.03;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
      pointer-events: none;
    }
    
    .content {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 920px;
    }
    
    .title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 32px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 36px;
      line-height: 1.25;
      letter-spacing: -0.01em;
    }
    
    .post-line {
      font-family: 'Inter', sans-serif;
      font-size: 24px;
      font-weight: 300;
      line-height: 1.55;
      margin-bottom: 10px;
      color: #e5e5e5;
      letter-spacing: 0.01em;
    }
    
    .ellipsis {
      font-size: 24px;
      color: #666666;
      margin-top: 12px;
      font-weight: 300;
    }
    
    .footer {
      position: absolute;
      bottom: 36px;
      left: 90px;
      right: 90px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 1;
      border-top: 1px solid #333333;
      padding-top: 20px;
    }
    
    .author {
      font-family: 'Inter', sans-serif;
      font-size: 15px;
      font-weight: 500;
      color: #ffffff;
      letter-spacing: 0.08em;
      text-transform: lowercase;
    }
    
    .brand {
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 400;
      color: #666666;
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="accent-bar"></div>
  <div class="content">
    <div class="title">${escapeHtml(title)}</div>
    ${bodyText}
    ${hasMore ? '<div class="ellipsis">...</div>' : ""}
  </div>
  <div class="footer">
    <div class="author">@${escapeHtml(authorName || "cpaschalidi")}</div>
    <div class="brand">LinkedIn</div>
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
