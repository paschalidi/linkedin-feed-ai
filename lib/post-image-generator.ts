import { chromium } from "playwright";
import { IMAGE_WIDTH, IMAGE_HEIGHT } from "./image-config";

export interface PostImageOptions {
  title: string;
  content: string;
  authorName?: string;
}

/**
 * Generate a minimal branded image at LinkedIn portrait dimensions (1080×1350).
 * Renders the first two paragraphs of the post centred on a dark green canvas.
 *
 * Uses Playwright to screenshot a styled HTML page.
 * Tweak IMAGE_WIDTH / IMAGE_HEIGHT in lib/image-config.ts to change sizing.
 */
export async function generatePostImage(
  options: PostImageOptions
): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT },
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

function buildImageHtml({ content }: PostImageOptions): string {
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
    Show the first 2 paragraphs — hook + punch — centred on the canvas.
    The full post stays in the LinkedIn caption; the image is the teaser.
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
      width: ${IMAGE_WIDTH}px;
      height: ${IMAGE_HEIGHT}px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0d2418;
      color: #ffffff;
      position: relative;
      overflow: hidden;
    }

    /*
      Subtle peach bloom anchored at the bottom edge — most of it bleeds
      below the canvas so only a faint warm glow is visible.
    */
    .bloom {
      position: absolute;
      left: 50%;
      bottom: -${Math.round(IMAGE_HEIGHT * 0.55)}px;
      transform: translateX(-50%);
      width: ${Math.round(IMAGE_WIDTH * 1.4)}px;
      height: ${Math.round(IMAGE_HEIGHT * 0.7)}px;
      background: radial-gradient(ellipse at center,
        rgba(248, 218, 188, 0.55) 0%,
        rgba(240, 188, 150, 0.25) 35%,
        rgba(13, 36, 24, 0) 70%);
      filter: blur(80px);
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
      padding: 360px 90px;
      text-align: center;
      z-index: 1;
    }

    .post-line {
      font-family: 'Inter', sans-serif;
      font-size: 48px;
      font-weight: 300;
      color: rgba(255, 255, 255, 0.94);
      line-height: 1.4;
      margin-bottom: 32px;
      max-width: 880px;
      letter-spacing: 0.005em;
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
