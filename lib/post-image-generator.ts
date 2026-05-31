import { chromium } from "playwright";

export interface PostImageOptions {
  title: string;
  content: string;
  authorName?: string;
}

/**
 * Generate a branded image that looks like a phone screen.
 *
 * The image is rendered as a realistic phone device sitting on
 * a dark surface, with the post text displayed inside the screen.
 * Output: 960x1200 PNG (4:5 portrait, mobile-optimised for LinkedIn).
 */
export async function generatePostImage(
  options: PostImageOptions
): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 960, height: 1200 },
      deviceScaleFactor: 2,
    });

    const html = buildImageHtml(options);
    await page.setContent(html, { waitUntil: "networkidle" });

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
  const cleanContent = content
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "");

  const lines = cleanContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

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
      width: 960px;
      height: 1200px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      position: relative;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    /* Subtle vignette on the table surface */
    body::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at 50% 40%,
        rgba(30, 30, 35, 0.6) 0%,
        rgba(10, 10, 10, 0) 70%);
      pointer-events: none;
    }

    /* Phone device */
    .phone {
      position: relative;
      width: 720px;
      height: 1040px;
      background: #1a1a1a;
      border-radius: 60px;
      padding: 18px;
      box-shadow:
        0 0 0 2px #333,
        0 40px 80px rgba(0, 0, 0, 0.6),
        0 20px 40px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
      z-index: 1;
    }

    /* Phone screen */
    .screen {
      width: 100%;
      height: 100%;
      background: #0d2418;
      border-radius: 44px;
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 80px 48px 80px;
      text-align: center;
    }

    /* Notch */
    .notch {
      position: absolute;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      width: 160px;
      height: 28px;
      background: #1a1a1a;
      border-radius: 14px;
      z-index: 3;
    }

    /* Status bar time */
    .status-time {
      position: absolute;
      top: 20px;
      left: 32px;
      font-size: 14px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      z-index: 2;
    }

    /* Status bar icons (simplified) */
    .status-icons {
      position: absolute;
      top: 20px;
      right: 32px;
      display: flex;
      gap: 6px;
      align-items: center;
      z-index: 2;
    }

    .status-icon {
      width: 18px;
      height: 10px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.9);
    }

    .status-icon.battery {
      width: 24px;
      border-radius: 3px;
      position: relative;
    }

    .status-icon.battery::after {
      content: '';
      position: absolute;
      right: -3px;
      top: 3px;
      width: 2px;
      height: 4px;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 0 1px 1px 0;
    }

    /* Bottom home indicator */
    .home-bar {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      width: 140px;
      height: 5px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 3px;
      z-index: 2;
    }

    /* Bloom inside the screen */
    .bloom {
      position: absolute;
      left: 50%;
      bottom: -420px;
      transform: translateX(-50%);
      width: 1100px;
      height: 700px;
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

    /* Content */
    .content {
      position: relative;
      z-index: 1;
      width: 100%;
    }

    .post-line {
      font-family: 'Inter', sans-serif;
      font-size: 36px;
      font-weight: 400;
      color: rgba(255, 255, 255, 0.92);
      line-height: 1.4;
      margin-bottom: 14px;
      letter-spacing: 0.01em;
    }

    .post-line:last-child {
      margin-bottom: 0;
    }

    .author {
      position: absolute;
      bottom: 42px;
      left: 0;
      right: 0;
      text-align: center;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 500;
      color: #0d2418;
      letter-spacing: 0.18em;
      opacity: 0.95;
      z-index: 2;
    }
  </style>
</head>
<body>
  <div class="phone">
    <div class="screen">
      <div class="notch"></div>
      <div class="status-time">9:41</div>
      <div class="status-icons">
        <div class="status-icon" style="width: 16px; height: 10px; clip-path: polygon(0 70%, 30% 0, 100% 0, 100% 100%, 0 100%);"></div>
        <div class="status-icon wifi" style="width: 14px; height: 10px; background: transparent; border: 2px solid rgba(255,255,255,0.9); border-top: none; border-radius: 0 0 8px 8px; position: relative;">
          <div style="position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; background: rgba(255,255,255,0.9); border-radius: 50%;"></div>
        </div>
        <div class="status-icon battery"></div>
      </div>
      <div class="bloom"></div>
      <div class="content">
        ${bodyHtml}
      </div>
      <div class="author">@${escapeHtml(authorName || "paschalidi")}</div>
      <div class="home-bar"></div>
    </div>
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
