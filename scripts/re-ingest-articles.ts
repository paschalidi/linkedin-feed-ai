#!/usr/bin/env tsx
/**
 * Re-ingest all existing articles with the new Readability + chunking pipeline.
 *
 * Run this AFTER applying the migration:
 *   npx prisma migrate dev
 *   npx tsx scripts/re-ingest-articles.ts
 *
 * This script:
 * 1. Fetches all existing articles
 * 2. Re-extracts each with Mozilla Readability (better quality than old cheerio)
 * 3. Chunks the content
 * 4. Embeds each chunk with taskType=RETRIEVAL_DOCUMENT
 * 5. Stores chunks in article_chunks table
 * 6. Updates article metadata (excerpt, author, etc.)
 */

import "dotenv/config";
import { prisma } from "../lib/prisma";
import { extractArticle, computeContentHash } from "../lib/article-extractor";
import { chunkArticle } from "../lib/chunker";
import { generateEmbedding, formatEmbeddingForPostgres } from "../lib/gemini";
import { randomUUID } from "crypto";

async function reIngestAll() {
  console.log("Fetching existing articles...");
  const articles = await prisma.$queryRaw<
    Array<{ id: string; url: string; title: string; source_id: string | null }>
  >`SELECT id, url, title, source_id FROM articles ORDER BY created_at DESC`;

  console.log(`Found ${articles.length} articles to re-ingest.`);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const article of articles) {
    processed++;
    console.log(`[${processed}/${articles.length}] ${article.url}`);

    try {
      const { article: extracted, quality } = await extractArticle(article.url);

      if (!quality.ok) {
        console.warn(`  → Skipped: ${quality.reason}`);
        skipped++;
        continue;
      }

      const contentHash = computeContentHash(extracted.content);
      const chunks = chunkArticle(extracted.content);

      // Update article metadata
      await prisma.$executeRaw`
        UPDATE articles
        SET
          title = ${extracted.title || article.title},
          content = ${extracted.content},
          excerpt = ${extracted.excerpt || null},
          author = ${extracted.author || null},
          published_at = ${extracted.publishedAt || null},
          content_hash = ${contentHash},
          canonical_url = ${extracted.canonicalUrl || null},
          site_name = ${extracted.siteName || null},
          char_count = ${extracted.charCount},
          extraction_method = ${"readability"}
        WHERE id = ${article.id}
      `;

      // Delete old chunks (if any) and insert new ones
      await prisma.$executeRaw`
        DELETE FROM article_chunks WHERE article_id = ${article.id}
      `;

      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk.text, {
          taskType: "RETRIEVAL_DOCUMENT",
          title: extracted.title,
        });
        const embeddingLiteral = formatEmbeddingForPostgres(embedding);

        await prisma.$executeRaw`
          INSERT INTO article_chunks (id, article_id, chunk_index, text, char_start, char_end, embedding, created_at)
          VALUES (
            ${randomUUID()},
            ${article.id},
            ${chunk.index},
            ${chunk.text},
            ${chunk.charStart},
            ${chunk.charEnd},
            ${embeddingLiteral}::vector(768),
            NOW()
          )
        `;
      }

      console.log(`  → ${chunks.length} chunks, ${extracted.charCount} chars`);
      succeeded++;
    } catch (err: any) {
      console.error(`  → Failed: ${err.message}`);
      failed++;
    }
  }

  console.log("\n=== Re-ingest Complete ===");
  console.log(`Total: ${articles.length}`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Skipped (quality gate): ${skipped}`);
  console.log(`Failed: ${failed}`);
}

reIngestAll()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
