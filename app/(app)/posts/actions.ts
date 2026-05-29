"use server";

import { prisma } from "@/lib/prisma";
import { generateLinkedInPost } from "@/lib/gemini";
import { retrieveRelevantArticles } from "../compose/actions";

export async function getPost(id: string) {
  try {
    return await prisma.generatedPost.findUnique({
      where: { id },
      include: { idea: true },
    });
  } catch (err: any) {
    console.error("getPost error:", err);
    throw new Error(err?.message || "Failed to get post");
  }
}

export async function updatePost(formData: FormData) {
  try {
    const id = formData.get("id") as string;
    const finalContent = formData.get("final_content") as string;
    const status = formData.get("status") as string;

    return await prisma.generatedPost.update({
      where: { id },
      data: {
        finalContent,
        status,
      },
    });
  } catch (err: any) {
    console.error("updatePost error:", err);
    throw new Error(err?.message || "Failed to update post");
  }
}

export async function regeneratePost(id: string) {
  try {
    const post = await prisma.generatedPost.findUnique({
      where: { id },
      include: { idea: true },
    });

    if (!post || !post.idea) {
      throw new Error("Post or idea not found");
    }

    const idea = post.idea;
    const ideaText = `${idea.title} ${idea.description || ""}`;

    // Find active style, or fall back to any style profile
    let style = await prisma.styleProfile.findFirst({
      where: { isActive: true },
    });
    if (!style) {
      style = await prisma.styleProfile.findFirst({
        orderBy: { createdAt: "desc" },
      });
    }
    if (!style) throw new Error("No style profiles found. Create one in /styles first.");

    // Re-retrieve relevant articles with the same idea
    const articles = await retrieveRelevantArticles(ideaText);

    // Generate a fresh draft
    const draft = await generateLinkedInPost({
      idea: idea.title,
      ideaDescription: idea.description || undefined,
      stylePrompt: style.promptText,
      articles: articles.map((a: any) => ({
        title: a.title,
        content: a.content,
        url: a.url,
        bestChunk: a.best_chunk,
      })),
    });

    const sourcesSection =
      articles.length > 0
        ? "\n\n---\n\nSources:\n" +
          articles
            .map(
              (a: any) =>
                `• ${a.title} — ${a.url.replace(/^https?:\/\//, "").split("/")[0]}`
            )
            .join("\n")
        : "";

    const draftWithSources = draft.trim() + sourcesSection;

    // Update the post with the new draft
    return await prisma.generatedPost.update({
      where: { id },
      data: {
        draftContent: draftWithSources,
        finalContent: draftWithSources,
      },
    });
  } catch (err: any) {
    console.error("regeneratePost error:", err);
    throw new Error(err?.message || "Failed to regenerate post");
  }
}
