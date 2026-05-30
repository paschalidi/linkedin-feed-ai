import { chromium } from "playwright";

export interface PostImageOptions {
  title: string;
  content: string;
  authorName?: string;
}

/**
 * Generate a branded image with the post text rendered on it.
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
    await page.waitForTimeout(500);

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
    .slice(0, 700); // Limit to fit visually

  const lines = cleanContent.split("\n").filter((l) => l.trim().length > 0);
  const displayLines = lines.slice(0, 6); // Show first 6 non-empty lines
  const hasMore = lines.length > 6;

  const bodyText = displayLines
    .map((line) => `<p class="post-line">${escapeHtml(line)}</p>`)
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      width: 1200px;
      height: 627px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
      color: #f8fafc;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 60px 80px;
      position: relative;
      overflow: hidden;
    }
    
    /* Subtle accent top line */
    .accent-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: linear-gradient(90deg, #f59e0b, #d97706, #f59e0b);
    }
    
    /* Subtle background pattern */
    body::before {
      content: '';
      position: absolute;
      inset: 0;
      background: 
        radial-gradient(circle at 20% 80%, rgba(245, 158, 11, 0.08) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.06) 0%, transparent 50%);
      pointer-events: none;
    }
    
    .content {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 960px;
    }
    
    .title {
      font-size: 28px;
      font-weight: 700;
      color: #fbbf24;
      margin-bottom: 32px;
      line-height: 1.3;
      letter-spacing: -0.02em;
    }
    
    .post-line {
      font-size: 26px;
      font-weight: 400;
      line-height: 1.5;
      margin-bottom: 8px;
      color: #e2e8f0;
      letter-spacing: -0.01em;
    }
    
    .ellipsis {
      font-size: 26px;
      color: #94a3b8;
      margin-top: 8px;
    }
    
    .footer {
      position: absolute;
      bottom: 32px;
      left: 80px;
      right: 80px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 1;
    }
    
    .author {
      font-size: 16px;
      font-weight: 600;
      color: #94a3b8;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    
    .brand {
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
      letter-spacing: 0.1em;
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
    <div class="author">${escapeHtml(authorName || "")}</div>
    <div class="brand">LinkedIn Feed AI</div>
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
