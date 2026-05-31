import { prisma } from "@/lib/prisma";

interface GenerateIdeasOptions {
  articleCount?: number;
  styleAware?: boolean;
  recencyFilter?: number | null; // days, null = all articles
}

/**
 * Generate a DailyIdea by reading random articles and asking Gemini
 * to find a hidden thread / contrarian angle.
 *
 * Used by both the manual "Surprise Me" button and the daily cron.
 */
export async function generateDailyIdeas(options: GenerateIdeasOptions = {}) {
  const {
    articleCount = 5,
    styleAware = true,
    recencyFilter = 7,
  } = options;

  // Build article query
  const where = recencyFilter
    ? { createdAt: { gte: new Date(Date.now() - recencyFilter * 24 * 60 * 60 * 1000) } }
    : {};

  const allArticles = await prisma.article.findMany({
    where,
    select: { title: true, excerpt: true, content: true, author: true, url: true },
  });

  if (allArticles.length === 0) {
    return { success: false as const, error: "No articles found. Add some sources first." };
  }

  // Fisher-Yates shuffle
  const shuffled = [...allArticles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const sample = shuffled.slice(0, articleCount);

  const articleDigest = sample
    .map((a, i) => {
      const snippet = (a.excerpt || a.content).slice(0, 300);
      return `Article ${i + 1}: ${a.title}${a.author ? ` by ${a.author}` : ""}\n${snippet}`;
    })
    .join("\n\n---\n\n");

  // Fetch active style if styleAware
  let stylePrompt = "";
  if (styleAware) {
    const style = await prisma.styleProfile.findFirst({
      where: { isActive: true },
    });
    if (style) {
      stylePrompt = `\n\nThe user's writing style is: "${style.promptText.slice(0, 500)}"\nGenerate an idea that matches this voice.`;
    }
  }

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const prompt = `You are a senior tech editor who reads dozens of newsletters a week. Your job is to spot the hidden thread — the idea that connects 2-3 articles in a way nobody has articulated yet.

Below are recent articles. Do NOT summarize them. Instead:

1. Identify 2-3 underlying themes, tensions, or counter-intuitive insights that emerge across the articles.
2. Pick the ONE theme that would make the most compelling, original LinkedIn post.
3. Frame it as a practitioner's hot take — not a summary, but an angle.

Output STRICT JSON (no markdown, no code fences):
{
  "title": "A punchy, specific idea title (5-10 words)",
  "description": "The angle: 2-3 sentences on the tension, insight, or contrarian take. What makes this worth writing about? What would a practitioner say that a journalist wouldn't?"
}
${stylePrompt}

ARTICLES:
${articleDigest}`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 800 },
  });

  const text = result.response.text() ?? "";

  let jsonStr = text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(jsonStr);
  if (!parsed.title || !parsed.description) {
    throw new Error("Invalid response format from AI");
  }

  // Dedup: skip if same title exists in last 24h
  const normalizedTitle = parsed.title.trim().toLowerCase();
  const recentDuplicate = await prisma.dailyIdea.findFirst({
    where: {
      title: { equals: normalizedTitle, mode: "insensitive" },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (recentDuplicate) {
    return { success: false as const, error: "Duplicate idea generated recently. Skipping." };
  }

  return { success: true as const, title: parsed.title, description: parsed.description };
}
