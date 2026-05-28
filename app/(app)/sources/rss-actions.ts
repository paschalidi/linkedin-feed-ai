"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { fetchRSSFeed, filterRecentItems } from "@/lib/rss-parser";
import { fetchArticleText } from "@/lib/article-extractor";
import { generateEmbedding } from "@/lib/gemini";

export async function syncRSSFeed(sourceId: string, feedUrl: string) {
  const supabase = await createClient();

  try {
    // Fetch and parse RSS feed
    const feed = await fetchRSSFeed(feedUrl);
    
    // Filter recent items (last 30 days)
    const recentItems = filterRecentItems(feed.items, 30);

    let ingestedCount = 0;
    let skippedCount = 0;

    for (const item of recentItems) {
      // Skip if article already exists
      const { data: existing } = await supabase
        .from("articles")
        .select("id")
        .eq("url", item.link)
        .single();

      if (existing) {
        skippedCount++;
        continue;
      }

      // Fetch and extract article content
      try {
        const { title, content } = await fetchArticleText(item.link);
        
        // Generate embedding (768 dims from gemini-embedding-001 with Matryoshka truncation)
        const embedding = await generateEmbedding(content);

        // Store in database using raw SQL since Prisma doesn't natively support vector types
        await prisma.$executeRaw`
          INSERT INTO articles (source_id, title, url, content, embedding, created_at)
          VALUES (
            ${sourceId},
            ${title || item.title},
            ${item.link},
            ${content},
            ${embedding}::vector(768),
            NOW()
          )
        `;

        ingestedCount++;
      } catch (error) {
        console.error(`Failed to ingest article ${item.link}:`, error);
        // Continue with next article
      }
    }

    // Update source last_fetched_at
    await supabase
      .from("newsletter_sources")
      .update({ last_fetched_at: new Date().toISOString() })
      .eq("id", sourceId);

    return {
      success: true,
      ingested: ingestedCount,
      skipped: skippedCount,
      total: recentItems.length,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to sync RSS feed",
    };
  }
}
