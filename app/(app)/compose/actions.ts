"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding, generateLinkedInPost } from "@/lib/gemini";

export async function getIdeasForCompose() {
  try {
    return await prisma.dailyIdea.findMany({
      where: { status: { in: ["draft", "used"] } },
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
    const ideaIds = formData.getAll("idea_ids") as string[];
    const styleProfileId = formData.get("style_profile_id") as string;

    if (!ideaIds.length) throw new Error("Select at least one idea");

    // Get all selected ideas
    const ideas = await prisma.dailyIdea.findMany({
      where: { id: { in: ideaIds } },
    });
    if (ideas.length === 0) throw new Error("No ideas found");

    // Get the style profile
    const style = await prisma.styleProfile.findUnique({
      where: { id: styleProfileId },
    });
    if (!style) throw new Error("Style profile not found");

    // Combine all selected ideas for article retrieval and generation
    const combinedTitle = ideas.map((i) => i.title).join(" + ");
    const combinedDescription = ideas
      .map((i) => i.description)
      .filter(Boolean)
      .join("\n\n");
    const ideaText = `${combinedTitle} ${combinedDescription}`;
    const articles = await retrieveRelevantArticles(ideaText);

    // Generate the post
    const draft = await generateLinkedInPost({
      idea: combinedTitle,
      ideaDescription: combinedDescription || undefined,
      stylePrompt: style.promptText,
      articles: articles.map((a: any) => ({
        title: a.title,
        content: a.content,
        url: a.url,
      })),
    });

    // Store the generated post — link to the first idea as primary
    const primaryIdeaId = ideas[0].id;
    const post = await prisma.generatedPost.create({
      data: {
        ideaId: primaryIdeaId,
        draftContent: draft,
        finalContent: draft,
        status: "draft",
      },
    });

    // Mark all selected ideas as used
    await prisma.dailyIdea.updateMany({
      where: { id: { in: ideaIds } },
      data: { status: "used" },
    });

    return { post, articles };
  } catch (err: any) {
    console.error("composePost error:", err);
    throw new Error(err?.message || "Failed to compose post");
  }
}
