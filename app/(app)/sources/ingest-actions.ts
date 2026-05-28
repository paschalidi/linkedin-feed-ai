"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { fetchArticleText } from "@/lib/article-extractor";
import { generateEmbedding, formatEmbeddingForPostgres } from "@/lib/gemini";

export async function ingestArticle(sourceId: string, url: string) {
  const supabase = await createClient();

  // Fetch and extract article text
  const { title, content } = await fetchArticleText(url);

  // Generate embedding (768 dims from gemini-embedding-001 with Matryoshka truncation)
  const embedding = await generateEmbedding(content);
  const embeddingLiteral = formatEmbeddingForPostgres(embedding);

  const articleId = randomUUID();

  // Store in database using raw SQL since Prisma doesn't natively support vector types
  await prisma.$executeRaw`
    INSERT INTO articles (id, source_id, title, url, content, embedding, created_at)
    VALUES (
      ${articleId},
      ${sourceId},
      ${title},
      ${url},
      ${content},
      ${embeddingLiteral}::vector(768),
      NOW()
    )
  `;

  // Update source last_fetched_at
  await supabase
    .from("newsletter_sources")
    .update({ last_fetched_at: new Date().toISOString() })
    .eq("id", sourceId);

  return { id: articleId, source_id: sourceId, title, url, content };
}

export async function getArticlesBySource(sourceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("source_id", sourceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getAllArticles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}
