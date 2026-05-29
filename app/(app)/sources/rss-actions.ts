"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { fetchRSSFeed, filterRecentItems, RSSItem } from "@/lib/rss-parser";
import { fetchArticleText } from "@/lib/article-extractor";
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

export async function syncRSSFeed(
  sourceId: string,
  feedUrl: string,
  options: { isFirstSync?: boolean } = {}
): Promise<SyncResult> {
  const sourceName =
    (await prisma.newsletterSource.findUnique({ where: { id: sourceId }, select: { name: true } }))?.name || feedUrl;

  try {
    const feed = await fetchRSSFeed(feedUrl);

    // On first sync, only grab recent items to avoid ingesting years of archives.
    // On subsequent syncs, grab everything in the feed and dedupe by URL.
    const items = options.isFirstSync ? filterRecentItems(feed.items, 30) : feed.items;

    let ingestedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Collect all URLs to check for duplicates in a single query
    const links = items.map((item) => getItemLink(item, feedUrl)).filter(Boolean);
    const { data: existingArticles } = await (await createClient())
      .from("articles")
      .select("url")
      .in("url", links);

    const existingUrls = new Set((existingArticles || []).map((a) => a.url));

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

      try {
        const { title, content } = await fetchArticleText(link);
        const embedding = await generateEmbedding(content);
        const embeddingLiteral = formatEmbeddingForPostgres(embedding);

        await prisma.$executeRaw`
          INSERT INTO articles (id, source_id, title, url, content, embedding, created_at)
          VALUES (
            ${randomUUID()},
            ${sourceId},
            ${title || item.title || "Untitled"},
            ${link},
            ${content},
            ${embeddingLiteral}::vector(768),
            NOW()
          )
        `;

        ingestedCount++;
        existingUrls.add(link); // prevent duplicate within same batch
      } catch (error) {
        console.error(`Failed to ingest article ${link}:`, error);
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
