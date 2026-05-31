import { chromium } from "playwright";

export interface PostImageOptions {
  title: string;
  content: string;
  authorName?: string;
}

/**
 * Generate a branded image with phone-screen dimensions.
 *
 * The image uses a tall, narrow aspect ratio (390×844) that
 * matches a phone screen, so it looks native on mobile feeds.
 *
 * Uses Playwright to screenshot a styled HTML page.
 */
export async function generatePostImage(
  options: PostImageOptions
): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
    });

    const html = buildImageHtml(options);
    await page.setContent(html, { waitUntil: "networkidle" });

    // Extra time for Google Fonts to arrive
    await page.waitForTimeout(900);

    const screenshot = await page.screenshot({
      type: "png",
      fullPage: false,
    });

    return screenshot;
  } finally {
    await browser.close();
  }
}

function buildImageHtml({ content, authorName }: PostImageOptions): string {
  // Strip markdown remnants
  const cleanContent = content
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "");

  const lines = cleanContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  /*
    Show only the first 2 paragraphs on the image — the hook + the punch.
    This keeps the image punchy and readable on mobile.
    The full post stays at 120–180 words; the image is just a teaser.
  */
  const displayLines = lines.slice(0, 2);

  const bodyHtml = displayLines
    .map((line) => `<p class="post-line">${escapeHtml(line)}</p>`)
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      width: 390px;
      height: 844px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0d2418;
      color: #ffffff;
      position: relative;
      overflow: hidden;
    }

    /*
      Warm peach bloom centred near the bottom.
      Tall enough to bleed past the canvas edge so only the soft
      upper glow is visible inside the card.
    */
    .bloom {
      position: absolute;
      left: 50%;
      bottom: -380px;
      transform: translateX(-50%);
      width: 600px;
      height: 550px;
      background: radial-gradient(ellipse at center,
        rgba(248, 218, 188, 0.98) 0%,
        rgba(246, 206, 172, 0.80) 18%,
        rgba(240, 188, 150, 0.50) 35%,
        rgba(220, 160, 120, 0.22) 55%,
        rgba(13, 36, 24, 0) 75%);
      filter: blur(40px);
      pointer-events: none;
      z-index: 0;
    }

    .page {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 60px 32px 60px;
      text-align: center;
      z-index: 1;
    }

    .author {
      position: absolute;
      bottom: 20px;
      left: 0;
      right: 0;
      text-align: center;
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 500;
      color: #0d2418;
      letter-spacing: 0.15em;
      opacity: 0.95;
      z-index: 2;
    }

    .post-line {
      font-family: 'Inter', sans-serif;
      font-size: 22px;
      font-weight: 400;
      color: rgba(255, 255, 255, 0.92);
      line-height: 1.35;
      margin-bottom: 12px;
      max-width: 310px;
      letter-spacing: 0.01em;
    }

    .post-line:last-child {
      margin-bottom: 0;
    }
  </style>
</head>
<body>
  <div class="bloom"></div>
  <div class="page">
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
