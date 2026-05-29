"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding, generateLinkedInPost } from "@/lib/gemini";
import { getRandomSamplePosts } from "@/lib/linkedin-style";

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

async function buildIdeaText(formData: FormData) {
  const ideaIds = formData.getAll("idea_ids") as string[];
  const ideas = await prisma.dailyIdea.findMany({
    where: { id: { in: ideaIds } },
  });
  const combinedTitle = ideas.map((i) => i.title).join(" + ");
  const combinedDescription = ideas
    .map((i) => i.description)
    .filter(Boolean)
    .join("\n\n");
  return {
    ideaText: `${combinedTitle} ${combinedDescription}`,
    combinedTitle,
    combinedDescription,
    primaryIdeaId: ideas[0]?.id,
    ideaCount: ideas.length,
  };
}

export async function retrieveRelevantArticles(ideaText: string) {
  try {
    const supabase = await createClient();

    // Generate query embedding with taskType=RETRIEVAL_QUERY
    const embedding = await generateEmbedding(ideaText, {
      taskType: "RETRIEVAL_QUERY",
    });

    // Get total chunk count to decide strategy
    const { count } = await supabase
      .from("article_chunks")
      .select("*", { count: "exact", head: true });

    const totalChunks = count || 0;

    // Dynamic threshold: chunk-level similarity scores are higher on average
    // (smaller texts compare more precisely) so we start higher than before.
    const threshold =
      totalChunks < 20 ? 0.0 : totalChunks < 100 ? 0.35 : 0.5;
    const limit = Math.min(10, totalChunks);

    let { data: vectorResults, error } = await supabase.rpc(
      "match_articles",
      {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
      }
    );

    if (error) throw error;
    vectorResults = vectorResults || [];

    // Fallback: if vector search returns very few results, do keyword search too
    if (vectorResults.length < 3 && totalChunks > vectorResults.length) {
      const stopWords = new Set([
        "this", "that", "with", "from", "about", "your", "have", "been",
        "their", "they", "will", "would", "should", "could", "there", "where",
        "when", "what", "how", "than", "more", "some", "only", "other", "time",
        "very", "after", "most", "made", "many", "also", "back", "years", "work",
        "well", "even", "these", "them", "then", "know", "take", "people", "into",
        "year", "good", "just", "first", "over", "think", "look", "want", "give",
        "being", "each", "which", "make", "like", "come", "those", "way", "may",
        "say", "great", "day", "use", "man", "new", "now", "own", "too", "old",
        "tell", "here", "long", "such", "never", "might", "shall", "still",
        "while",
      ]);

      const keywords = ideaText
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !stopWords.has(w));

      if (keywords.length > 0) {
        const orFilters = keywords
          .map((k) => `title.ilike.%${k}%,content.ilike.%${k}%`)
          .join(",");

        const { data: keywordResults } = await supabase
          .from("articles")
          .select("id, source_id, title, url, content")
          .or(orFilters)
          .limit(10);

        if (keywordResults && keywordResults.length > 0) {
          const existingIds = new Set(vectorResults.map((a: any) => a.id));
          for (const kr of keywordResults) {
            if (!existingIds.has(kr.id)) {
              vectorResults.push({
                ...kr,
                best_chunk: kr.content, // keyword fallback: use full content as "best chunk"
                best_chunk_index: 0,
                similarity: 0.01,
              });
            }
          }
        }
      }
    }

    return vectorResults;
  } catch (err: any) {
    console.error("retrieveRelevantArticles error:", err);
    return [];
  }
}

export async function previewSources(formData: FormData) {
  const { ideaText } = await buildIdeaText(formData);
  if (!ideaText.trim()) throw new Error("Select at least one idea");

  const articles = await retrieveRelevantArticles(ideaText);
  return articles.map((a: any) => ({
    id: a.id,
    title: a.title,
    url: a.url,
    similarity: typeof a.similarity === "number" ? a.similarity : undefined,
  }));
}

export async function generatePost(formData: FormData) {
  const ideaIds = formData.getAll("idea_ids") as string[];
  const styleProfileId = formData.get("style_profile_id") as string;

  if (!ideaIds.length) throw new Error("Select at least one idea");

  const {
    combinedTitle,
    combinedDescription,
    ideaText,
    primaryIdeaId,
    ideaCount,
  } = await buildIdeaText(formData);

  if (ideaCount === 0) throw new Error("No ideas found");

  const style = await prisma.styleProfile.findUnique({
    where: { id: styleProfileId },
  });
  if (!style) throw new Error("Style profile not found");

  const articles = await retrieveRelevantArticles(ideaText);

  // If using a cloned voice, inject few-shot examples
  let examples: string[] | undefined;
  if (style.isClonedVoice) {
    examples = await getRandomSamplePosts(3);
  }

  const draft = await generateLinkedInPost({
    idea: combinedTitle,
    ideaDescription: combinedDescription || undefined,
    stylePrompt: style.promptText,
    articles: articles.map((a: any) => ({
      title: a.title,
      content: a.content,
      url: a.url,
      bestChunk: a.best_chunk,
    })),
    examples,
  });

  const draftWithSources = draft.trim();

  const post = await prisma.generatedPost.create({
    data: {
      ideaId: primaryIdeaId!,
      draftContent: draftWithSources,
      finalContent: draftWithSources,
      status: "draft",
    },
  });

  await prisma.dailyIdea.updateMany({
    where: { id: { in: ideaIds } },
    data: { status: "used" },
  });

  return post;
}

export async function composePost(formData: FormData) {
  // Legacy single-step action — kept for backwards compatibility
  try {
    const post = await generatePost(formData);
    return { post };
  } catch (err: any) {
    console.error("composePost error:", err);
    throw new Error(err?.message || "Failed to compose post");
  }
}
