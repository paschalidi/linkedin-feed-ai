"use server";

import { prisma } from "@/lib/prisma";
import { generateLinkedInPost } from "@/lib/gemini";
import { retrieveRelevantArticles } from "../compose/actions";
import { createLinkedInPost } from "@/lib/zernio";

interface Version {
  content: string;
  createdAt: string;
}

function getVersions(post: { versions: string | null }): Version[] {
  try {
    return JSON.parse(post.versions || "[]") as Version[];
  } catch {
    return [];
  }
}

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

    // Also update the current version in the versions array
    const post = await prisma.generatedPost.findUnique({ where: { id } });
    if (!post) throw new Error("Post not found");

    const versions = getVersions(post);
    const currentIdx = post.currentVersionIndex ?? 0;

    if (versions[currentIdx]) {
      versions[currentIdx].content = finalContent;
    }

    return await prisma.generatedPost.update({
      where: { id },
      data: {
        finalContent,
        status,
        versions: JSON.stringify(versions),
      },
    });
  } catch (err: any) {
    console.error("updatePost error:", err);
    throw new Error(err?.message || "Failed to update post");
  }
}

export async function navigateVersion(id: string, direction: "prev" | "next") {
  try {
    const post = await prisma.generatedPost.findUnique({ where: { id } });
    if (!post) throw new Error("Post not found");

    const versions = getVersions(post);
    const currentIdx = post.currentVersionIndex ?? 0;

    let newIdx = currentIdx;
    if (direction === "prev" && currentIdx > 0) {
      newIdx = currentIdx - 1;
    } else if (direction === "next" && currentIdx < versions.length - 1) {
      newIdx = currentIdx + 1;
    }

    if (newIdx === currentIdx) return post; // No change

    const newContent = versions[newIdx].content;

    return await prisma.generatedPost.update({
      where: { id },
      data: {
        currentVersionIndex: newIdx,
        draftContent: newContent,
        finalContent: newContent,
      },
    });
  } catch (err: any) {
    console.error("navigateVersion error:", err);
    throw new Error(err?.message || "Failed to navigate versions");
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

    const draftWithSources = draft.trim();

    // Save current content to versions before overwriting
    const versions = getVersions(post);
    const currentIdx = post.currentVersionIndex ?? 0;

    // If the current version already exists at this index, update it first
    // so we don't lose edits the user made to this version
    if (versions[currentIdx]) {
      versions[currentIdx].content = post.finalContent || post.draftContent;
    }

    // Append the new generation as a new version
    versions.push({
      content: draftWithSources,
      createdAt: new Date().toISOString(),
    });

    const newIdx = versions.length - 1;

    // Update the post with the new version
    return await prisma.generatedPost.update({
      where: { id },
      data: {
        draftContent: draftWithSources,
        finalContent: draftWithSources,
        versions: JSON.stringify(versions),
        currentVersionIndex: newIdx,
      },
    });
  } catch (err: any) {
    console.error("regeneratePost error:", err);
    throw new Error(err?.message || "Failed to regenerate post");
  }
}

export async function savePostContent(id: string, content: string) {
  try {
    const post = await prisma.generatedPost.findUnique({ where: { id } });
    if (!post) throw new Error("Post not found");

    const versions = getVersions(post);
    const currentIdx = post.currentVersionIndex ?? 0;

    if (versions[currentIdx]) {
      versions[currentIdx].content = content;
    }

    return await prisma.generatedPost.update({
      where: { id },
      data: {
        finalContent: content,
        versions: JSON.stringify(versions),
      },
    });
  } catch (err: any) {
    console.error("savePostContent error:", err);
    throw new Error(err?.message || "Failed to save post content");
  }
}

export async function updatePostStatus(id: string, status: string) {
  try {
    return await prisma.generatedPost.update({
      where: { id },
      data: { status },
    });
  } catch (err: any) {
    console.error("updatePostStatus error:", err);
    throw new Error(err?.message || "Failed to update post status");
  }
}

export async function publishToLinkedIn(id: string, content: string) {
  try {
    if (!content || content.trim().length === 0) {
      throw new Error("Post has no content to publish");
    }

    const accountId = process.env.ZERNIO_LINKEDIN_ACCOUNT_ID;
    if (!accountId) {
      throw new Error(
        "ZERNIO_LINKEDIN_ACCOUNT_ID is not configured. Add it to your .env.local file."
      );
    }

    const result = await createLinkedInPost(content, accountId);

    // Mark as posted and record the LinkedIn post ID
    await prisma.generatedPost.update({
      where: { id },
      data: {
        status: "posted",
        linkedInPostId: result.postId,
        publishedToLinkedInAt: new Date(),
      },
    });

    return { success: true, postId: result.postId, postUrl: result.postUrl };
  } catch (err: any) {
    console.error("publishToLinkedIn error:", err);
    throw new Error(err?.message || "Failed to publish to LinkedIn");
  }
}
