"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { fetchRSSFeed, filterRecentItems, RSSItem } from "@/lib/rss-parser";
import { extractArticle, computeContentHash } from "@/lib/article-extractor";
import { chunkArticle } from "@/lib/chunker";
import { generateEmbedding, formatEmbeddingForPostgres } from "@/lib/gemini";

function resolveUrl(link: string, feedUrl: string): string {
  if (!link) return "";
  if (link.startsWith("http://") || link.startsWith("https://")) {
    return link;
  }
  try {
    return new URL(link, feedUrl).href;
  } catch {
    return link;
  }
}

function getItemLink(item: RSSItem, feedUrl: string): string {
  const raw = item.link || (item as any).guid || "";
  return resolveUrl(raw, feedUrl);
}

interface SyncResult {
  sourceId: string;
  sourceName: string;
  success: boolean;
  ingested: number;
  skipped: number;
  failed: number;
  total: number;
  error?: string;
}

/**
 * Ingest a single article: extract, chunk, embed each chunk, store.
 */
async function ingestSingleArticle(
  url: string,
  sourceId: string,
  fallbackTitle: string
): Promise<{ articleId: string; stored: boolean; reason?: string }> {
  try {
    const { article, quality } = await extractArticle(url);

    if (!quality.ok) {
      console.warn(`Skipping ${url}: ${quality.reason}`);
      return { articleId: "", stored: false, reason: quality.reason };
    }

    // Content-hash dedup
    const contentHash = computeContentHash(article.content);
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM articles WHERE content_hash = ${contentHash} LIMIT 1
    `;
    if (existing.length > 0) {
      return {
        articleId: existing[0].id,
        stored: false,
        reason: "duplicate content hash",
      };
    }

    const articleId = randomUUID();
    const chunks = chunkArticle(article.content);

    // Insert article (no embedding — lives on chunks now)
    await prisma.$executeRaw`
      INSERT INTO articles (
        id, source_id, title, url, content,
        excerpt, author, published_at, content_hash,
        canonical_url, site_name, char_count, extraction_method, created_at
      )
      VALUES (
        ${articleId},
        ${sourceId},
        ${article.title || fallbackTitle || "Untitled"},
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

    // Embed each chunk with taskType=RETRIEVAL_DOCUMENT and article title
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

    return { articleId, stored: true };
  } catch (error) {
    console.error(`Failed to ingest article ${url}:`, error);
    return { articleId: "", stored: false, reason: String(error) };
  }
}

export async function syncRSSFeed(
  sourceId: string,
  feedUrl: string,
  options: { isFirstSync?: boolean } = {}
): Promise<SyncResult> {
  const sourceName =
    (
      await prisma.newsletterSource.findUnique({
        where: { id: sourceId },
        select: { name: true },
      })
    )?.name || feedUrl;

  try {
    const feed = await fetchRSSFeed(feedUrl);

    // On first sync, only grab recent items to avoid ingesting years of archives.
    // On subsequent syncs, grab everything in the feed and dedupe by URL/hash.
    const items = options.isFirstSync
      ? filterRecentItems(feed.items, 30)
      : feed.items;

    let ingestedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Collect all URLs to check for duplicates in a single query
    const links = items
      .map((item) => getItemLink(item, feedUrl))
      .filter(Boolean);
    const { data: existingArticles } = await (await createClient())
      .from("articles")
      .select("url")
      .in("url", links);

    const existingUrls = new Set(
      (existingArticles || []).map((a) => a.url)
    );

    for (const item of items) {
      const link = getItemLink(item, feedUrl);
      if (!link) {
        failedCount++;
        continue;
      }

      if (existingUrls.has(link)) {
        skippedCount++;
        continue;
      }

      const result = await ingestSingleArticle(
        link,
        sourceId,
        item.title
      );

      if (result.stored) {
        ingestedCount++;
        existingUrls.add(link); // prevent duplicate within same batch
      } else if (result.reason?.includes("duplicate")) {
        skippedCount++;
      } else {
        failedCount++;
      }
    }

    // Update source last_fetched_at
    await prisma.newsletterSource.update({
      where: { id: sourceId },
      data: { lastFetchedAt: new Date() },
    });

    return {
      sourceId,
      sourceName,
      success: true,
      ingested: ingestedCount,
      skipped: skippedCount,
      failed: failedCount,
      total: items.length,
    };
  } catch (error: any) {
    console.error(`Failed to sync RSS feed ${feedUrl}:`, error);
    return {
      sourceId,
      sourceName,
      success: false,
      ingested: 0,
      skipped: 0,
      failed: 0,
      total: 0,
      error: error.message || "Failed to sync RSS feed",
    };
  }
}

export async function syncAllRSSFeeds(): Promise<SyncResult[]> {
  const sources = await prisma.newsletterSource.findMany({
    where: { type: "rss" },
    orderBy: { createdAt: "desc" },
  });

  const results: SyncResult[] = [];

  for (const source of sources) {
    if (!source.url) continue;
    const isFirstSync = !source.lastFetchedAt;
    const result = await syncRSSFeed(source.id, source.url, { isFirstSync });
    results.push(result);
  }

  return results;
}
