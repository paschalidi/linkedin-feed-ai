"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { extractArticle, computeContentHash } from "@/lib/article-extractor";
import { chunkArticle } from "@/lib/chunker";
import { generateEmbedding, formatEmbeddingForPostgres } from "@/lib/gemini";

export async function ingestArticle(sourceId: string, url: string) {
  const supabase = await createClient();

  // Extract article using Mozilla Readability + metadata
  const { article, quality } = await extractArticle(url);

  if (!quality.ok) {
    throw new Error(`Article rejected: ${quality.reason}`);
  }

  // Content-hash dedup
  const contentHash = computeContentHash(article.content);
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM articles WHERE content_hash = ${contentHash} LIMIT 1
  `;
  if (existing.length > 0) {
    throw new Error("This article has already been ingested (duplicate content)");
  }

  const articleId = randomUUID();
  const chunks = chunkArticle(article.content);

  // Store article metadata (no embedding — lives on chunks now)
  await prisma.$executeRaw`
    INSERT INTO articles (
      id, source_id, title, url, content,
      excerpt, author, published_at, content_hash,
      canonical_url, site_name, char_count, extraction_method, created_at
    )
    VALUES (
      ${articleId},
      ${sourceId},
      ${article.title},
      ${url},
      ${article.content},
      ${article.excerpt || null},
      ${article.author || null},
      ${article.publishedAt || null},
      ${contentHash},
      ${article.canonicalUrl || null},
      ${article.siteName || null},
      ${article.charCount},
      ${"readability"},
      NOW()
    )
  `;

  // Embed each chunk with taskType=RETRIEVAL_DOCUMENT + article title
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.text, {
      taskType: "RETRIEVAL_DOCUMENT",
      title: article.title,
    });
    const embeddingLiteral = formatEmbeddingForPostgres(embedding);

    await prisma.$executeRaw`
      INSERT INTO article_chunks (id, article_id, chunk_index, text, char_start, char_end, embedding, created_at)
      VALUES (
        ${randomUUID()},
        ${articleId},
        ${chunk.index},
        ${chunk.text},
        ${chunk.charStart},
        ${chunk.charEnd},
        ${embeddingLiteral}::vector(768),
        NOW()
      )
    `;
  }

  // Update source last_fetched_at
  await supabase
    .from("newsletter_sources")
    .update({ last_fetched_at: new Date().toISOString() })
    .eq("id", sourceId);

  return { id: articleId, source_id: sourceId, title: article.title, url, content: article.content };
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
