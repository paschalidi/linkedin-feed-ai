# ADR 002: RSS Auto-Fetching System

## Status

Accepted

## Context

The app allows users to add "sources" — either single article URLs (manual) or RSS/Atom feeds. Originally, only manual single-article ingestion worked. RSS feeds were stored as `NewsletterSource` rows with `type: "rss"`, but there was no automated mechanism to:

1. Poll feeds regularly for new articles.
2. Detect which articles had already been ingested (deduplication).
3. Extract text, generate embeddings, and store them in the vector DB.
4. Handle real-world RSS quirks (relative URLs, `guid` vs `link`, malformed feeds, etc.).

Users want to add "many many" blog feeds and accumulate a large article corpus for the composer to draw from.

## Decision

We built a complete RSS auto-fetching pipeline with the following design choices:

### 1. Sync Action: `syncRSSFeed()` and `syncAllRSSFeeds()`

Two server actions live in `app/(app)/sources/rss-actions.ts`:

- **`syncRSSFeed(sourceId, feedUrl, { isFirstSync })`** — fetches a single feed, deduplicates, ingests new articles, updates `lastFetchedAt`.
- **`syncAllRSSFeeds()`** — loops over all `type: "rss"` sources and calls `syncRSSFeed` for each.

**Key behaviour:**
- **First sync** (`!source.lastFetchedAt`): only ingests items from the last 30 days (`filterRecentItems`). Prevents ingesting years of archive backlog when a user first adds a feed.
- **Subsequent syncs**: fetches the entire current feed (typically the last 10–50 items) and deduplicates against the DB. This ensures we never miss articles that appear between syncs.
- **Batch deduplication**: before processing, all item URLs are collected and queried against `articles` in a single `IN` query, then stored in a `Set` for O(1) lookup. This avoids N+1 queries.
- **URL resolution**: some feeds emit relative URLs (`/post/123`) or use `guid` instead of `link`. We resolve relative URLs with `new URL(link, feedUrl)` and fall back to `guid` when `link` is absent.

### 2. Duplicate Protection (Three Layers)

We deduplicate at three levels to prevent the same article from being ingested twice:

1. **Batch URL pre-check** — before processing any feed items, all item URLs are collected and queried against `articles` in a single `SELECT url FROM articles WHERE url = ANY(...)::text[]`. Results are stored in a `Set` for O(1) lookup during the loop.

2. **Per-item URL check** — each item URL is checked against the in-memory `Set` before ingestion. If it exists, the item is counted as `skipped`.

3. **Content hash dedup** — `ingestSingleArticle()` computes a hash of the extracted article text (`computeContentHash`). If that hash already exists in the DB (via `contentHash` column with `@unique`), the article is skipped even if the URL is different (e.g., domain change, redirect).

### 3. Article Ingestion Pipeline

For each new RSS item that passes dedup:

1. **Fetch HTML** via `fetchArticleText()` (Cheerio-based extractor).
2. **Generate embedding** via `generateEmbedding()` (`gemini-embedding-001`, 768 dims via Matryoshka truncation).
3. **Store via raw SQL** `::vector(768)` because Prisma does not support the `vector` pgtype natively.
4. **Skip on failure** — one bad article (e.g., paywall, 404) does not abort the whole feed sync.

### 3. Sources Page UI

The `/sources` page now shows:

- **Per-source article count** — queried via a single `GROUP BY source_id` aggregation in `getSourceArticleCounts()`.
- **"Sync All RSS" button** — top-level action that loops all RSS sources.
- **Per-source "Sync" button** — each RSS row has its own refresh icon to trigger `syncRSSFeed` for that feed only.
- **Manual sources** still have the individual "Ingest" (download) button.
- **Total article count** displayed in the header.

### 4. Automated Background Sync via Cron Route

A `GET` route at `/api/cron/sync-rss` calls `syncAllRSSFeeds()`. It is protected by an optional `CRON_SECRET` env var checked against the `Authorization: Bearer <token>` header.

This enables:
- **Vercel Cron Jobs** — configure a `vercel.json` cron schedule to hit this endpoint.
- **External schedulers** — any cron service (GitHub Actions, AWS EventBridge, etc.) can `curl` the endpoint.
- **Manual trigger** — admins can hit it directly with the secret for on-demand full sync.

## Consequences

### Positive

- **Scalable accumulation**: Adding 10–20 blog RSS feeds will continuously build the article corpus without manual intervention.
- **Efficient deduplication**: The batch URL query + in-memory `Set` makes re-syncs fast even with hundreds of existing articles.
- **Robust to real-world feeds**: Relative URLs and `guid` fields are handled, so popular blog platforms (Substack, Medium, Ghost, WordPress) work out of the box.
- **Graceful degradation**: One broken article or bad feed does not crash the entire sync.
- **Visible progress**: Article counts and last-fetched timestamps give users confidence the system is working.

### Negative / Trade-offs

- **No incremental feed parsing**: We fetch the whole feed every time. RSS feeds typically return the last N items (10–50), so bandwidth is negligible, but very large feeds could be wasteful. RSS `etag`/`last-modified` caching is not implemented.
- ~~No deduplication by content hash~~ → **Fixed**: Content hash dedup is now implemented. Same article text is skipped even if the URL changed.
- **Embedding cost**: Every new article triggers a Gemini embedding API call. With 20 feeds × 5 new articles/day = 100 embeddings/day. At `gemini-embedding-001` pricing (~$0.15/1M tokens), this is essentially free on the paid tier and well within free-tier limits.
- **Foreign key on first idea only**: When multi-selecting ideas in the composer, the generated post still links to `ideas[0].id`. A true many-to-many join table is deferred.
- **No feed health monitoring**: If a feed goes permanently offline, the sync will silently fail on each run. A future enhancement could surface per-feed error counts in the UI.

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Store raw RSS XML in DB and parse later | Would bloat the DB with unstructured XML and delay text extraction. We extract immediately so articles are searchable. |
| Use a queue (BullMQ, SQS, etc.) | Overkill for the current scale. Next.js server actions + cron route are simpler and cost nothing extra. If feeds grow to 100+ or articles/day hits 1000+, a queue becomes warranted. |
| WebSub (PubSubHubbub) push instead of polling | More efficient but requires publishers to support it. Most independent blogs do not. Polling is the universal fallback. |
| Only sync items newer than `lastFetchedAt` | RSS `pubDate` is unreliable and often missing. URL-based deduplication is more robust. |
| Use `lastBuildDate` / `etag` to skip unchanged feeds | Would require persisting etag/last-modified per source. Accepted as a future optimisation, not MVP. |

## Related Files

- `app/(app)/sources/rss-actions.ts` — `syncRSSFeed()`, `syncAllRSSFeeds()`
- `app/(app)/sources/actions.ts` — `getSourceArticleCounts()`
- `app/(app)/sources/page.tsx` — Sources UI with sync buttons and counts
- `app/api/cron/sync-rss/route.ts` — Automated cron endpoint
- `lib/rss-parser.ts` — `fetchRSSFeed()`, `parseRSSFeed()`, `filterRecentItems()`
- `lib/article-extractor.ts` — HTML → readable text (Cheerio)
- `lib/gemini.ts` — `generateEmbedding()`, `formatEmbeddingForPostgres()`

## Deployment Notes

To enable automatic syncing in production:

1. Set `CRON_SECRET` in your environment (any random string).
2. Add a cron schedule in Vercel Dashboard or `vercel.json`:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/sync-rss",
         "schedule": "0 */6 * * *"
       }
     ]
   }
   ```
   (This example runs every 6 hours.)
3. Or use an external scheduler with:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/sync-rss
   ```

## Date

2026-05-29
