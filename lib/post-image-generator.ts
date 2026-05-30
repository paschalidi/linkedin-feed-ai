import { chromium } from "playwright";

export interface PostImageOptions {
  title: string;
  content: string;
  authorName?: string;
}

/**
 * Generate a branded image with the post text rendered on it.
 * Deep forest-green canvas with a soft peach radial bloom at the bottom.
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
  // Clean up content: strip markdown remnants
  const cleanContent = content
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "");

  // All non-empty paragraphs — we want the full post
  const lines = cleanContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Dynamically shrink fonts so everything fits the canvas
  const titleLen = title.length;
  const titleFontSize =
    titleLen <= 32 ? 48 : titleLen <= 60 ? 40 : titleLen <= 90 ? 33 : 28;

  const totalBodyChars = lines.join(" ").length;
  const bodyFontSize =
    totalBodyChars <= 400 ? 26 : totalBodyChars <= 700 ? 22 : 19;

  const bodyHtml = lines
    .map((line) => `<p class="post-line">${escapeHtml(line)}</p>`)
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600&family=Inter:wght@400;500&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      width: 1200px;
      height: 627px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0d2418;
      color: #ffffff;
      position: relative;
      overflow: hidden;
    }

    /*
      Bloom pushed well below the canvas so only the very tip of the warm glow
      peeks up at the bottom edge — text area stays fully clear.
    */
    .bloom {
      position: absolute;
      left: 50%;
      bottom: -520px;
      transform: translateX(-50%);
      width: 1600px;
      height: 720px;
      background: radial-gradient(ellipse at center,
        rgba(248, 218, 188, 0.98) 0%,
        rgba(246, 206, 172, 0.80) 18%,
        rgba(240, 188, 150, 0.50) 35%,
        rgba(220, 160, 120, 0.22) 55%,
        rgba(13, 36, 24, 0) 75%);
      filter: blur(48px);
      pointer-events: none;
      z-index: 0;
    }

    /* Content column — centred vertically and horizontally on the canvas */
    .page {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 48px 100px 28px;
      text-align: center;
      z-index: 1;
    }

    .author {
      position: absolute;
      bottom: 14px;
      left: 0;
      right: 0;
      text-align: center;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 500;
      color: #0d2418;
      letter-spacing: 0.18em;
      opacity: 0.9;
      z-index: 2;
    }

    .title {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: ${titleFontSize}px;
      font-weight: 600;
      color: #ffffff;
      line-height: 1.15;
      letter-spacing: -0.02em;
      max-width: 920px;
      margin-bottom: 16px;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.18);
    }

    .post-line {
      font-family: 'Inter', sans-serif;
      font-size: ${bodyFontSize}px;
      font-weight: 400;
      color: rgba(255, 255, 255, 0.88);
      line-height: 1.5;
      margin-bottom: 8px;
      max-width: 920px;
      letter-spacing: 0.01em;
    }
  </style>
</head>
<body>
  <div class="bloom"></div>
  <div class="page">
    <div class="title">${escapeHtml(title)}</div>
    ${bodyHtml}
  </div>
  <div class="author">@${escapeHtml(authorName || "paschalidi")}</div>
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
