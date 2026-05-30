"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function getIdeas() {
  try {
    return await prisma.dailyIdea.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("getIdeas error:", err);
    return [];
  }
}

export async function addIdea(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const title = formData.get("title") as string;
    const description = formData.get("description") as string;

    return await prisma.dailyIdea.create({
      data: {
        title,
        description,
        userId: user.id,
        status: "draft",
      },
    });
  } catch (err: any) {
    console.error("addIdea error:", err);
    throw new Error(err?.message || "Failed to add idea");
  }
}

export async function archiveIdea(id: string) {
  try {
    await prisma.dailyIdea.update({
      where: { id },
      data: { status: "archived" },
    });
  } catch (err: any) {
    console.error("archiveIdea error:", err);
    throw new Error(err?.message || "Failed to archive idea");
  }
}

export async function reuseIdea(id: string) {
  try {
    await prisma.dailyIdea.update({
      where: { id },
      data: { status: "draft" },
    });
  } catch (err: any) {
    console.error("reuseIdea error:", err);
    throw new Error(err?.message || "Failed to reuse idea");
  }
}

export async function generatePostFromIdea(ideaId: string, styleProfileId: string) {
  try {
    const { generatePost } = await import("@/app/(app)/compose/actions");
    const formData = new FormData();
    formData.append("idea_ids", ideaId);
    formData.append("style_profile_id", styleProfileId);
    const post = await generatePost(formData);
    return { success: true as const, postId: post.id };
  } catch (err: any) {
    console.error("generatePostFromIdea error:", err);
    return { success: false as const, error: err?.message || "Failed to generate post" };
  }
}

export async function surpriseMe() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Fetch a pool of articles and shuffle randomly so each click gets a fresh mix
    const allArticles = await prisma.article.findMany({
      select: { title: true, excerpt: true, content: true, author: true, url: true },
    });

    if (allArticles.length === 0) {
      throw new Error("No articles found. Add some sources first.");
    }

    // Fisher-Yates shuffle for unbiased randomness
    const shuffled = [...allArticles];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Sample up to 30 random articles
    const sample = shuffled.slice(0, 30);

    // Build article digest — title + short excerpt
    const articleDigest = sample
      .map((a, i) => {
        const snippet = (a.excerpt || a.content).slice(0, 300);
        return `Article ${i + 1}: ${a.title}${a.author ? ` by ${a.author}` : ""}\n${snippet}`;
      })
      .join("\n\n---\n\n");

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

ARTICLES:
${articleDigest}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 800 },
    });

    const text = result.response.text() ?? "";

    // Extract JSON from response
    let jsonStr = text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(jsonStr);
    if (!parsed.title || !parsed.description) {
      throw new Error("Invalid response format from AI");
    }

    const idea = await prisma.dailyIdea.create({
      data: {
        title: parsed.title,
        description: parsed.description,
        userId: user.id,
        status: "draft",
      },
    });

    return { success: true as const, idea };
  } catch (err: any) {
    console.error("surpriseMe error:", err);
    return { success: false as const, error: err?.message || "Failed to generate idea" };
  }
}
