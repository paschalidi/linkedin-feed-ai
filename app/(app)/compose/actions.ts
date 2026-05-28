"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding, generateLinkedInPost } from "@/lib/openai";

export async function getIdeasForCompose() {
  try {
    return await prisma.dailyIdea.findMany({
      where: { status: "draft" },
      orderBy: { createdAt: "desc" },
    });
  } catch (err: any) {
    console.error("getIdeasForCompose error:", err);
    return [];
  }
}

export async function getActiveStyleProfile() {
  try {
    return await prisma.styleProfile.findFirst({
      where: { isActive: true },
    });
  } catch (err: any) {
    console.error("getActiveStyleProfile error:", err);
    return null;
  }
}

export async function getAllStyleProfiles() {
  try {
    return await prisma.styleProfile.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (err: any) {
    console.error("getAllStyleProfiles error:", err);
    return [];
  }
}

export async function retrieveRelevantArticles(ideaText: string) {
  try {
    const supabase = await createClient();
    const embedding = await generateEmbedding(ideaText);

    const { data, error } = await supabase.rpc("match_articles", {
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: 5,
    });

    if (error) throw error;
    return data || [];
  } catch (err: any) {
    console.error("retrieveRelevantArticles error:", err);
    return [];
  }
}

export async function composePost(formData: FormData) {
  try {
    const ideaId = formData.get("idea_id") as string;
    const styleProfileId = formData.get("style_profile_id") as string;

    // Get the idea
    const idea = await prisma.dailyIdea.findUnique({
      where: { id: ideaId },
    });
    if (!idea) throw new Error("Idea not found");

    // Get the style profile
    const style = await prisma.styleProfile.findUnique({
      where: { id: styleProfileId },
    });
    if (!style) throw new Error("Style profile not found");

    // Retrieve relevant articles
    const ideaText = `${idea.title} ${idea.description || ""}`;
    const articles = await retrieveRelevantArticles(ideaText);

    // Generate the post
    const draft = await generateLinkedInPost({
      idea: idea.title,
      ideaDescription: idea.description || undefined,
      stylePrompt: style.promptText,
      articles: articles.map((a: any) => ({
        title: a.title,
        content: a.content,
        url: a.url,
      })),
    });

    // Store the generated post
    const post = await prisma.generatedPost.create({
      data: {
        ideaId,
        draftContent: draft,
        finalContent: draft,
        status: "draft",
      },
    });

    // Mark idea as used
    await prisma.dailyIdea.update({
      where: { id: ideaId },
      data: { status: "used" },
    });

    return { post, articles };
  } catch (err: any) {
    console.error("composePost error:", err);
    throw new Error(err?.message || "Failed to compose post");
  }
}
