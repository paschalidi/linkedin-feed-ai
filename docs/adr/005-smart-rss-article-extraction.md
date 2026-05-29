# ADR 005: Smart RSS Sync — Crawling Individual Articles from Newsletter Issue Pages

## Status

Accepted

## Context

RSS feeds from curated newsletters (e.g., Pointer.io, Software Lead Weekly) do not link directly to individual articles. Instead, they link to "issue pages" — a single HTML page containing 10–15 curated article links with brief commentary.

**Example:** Pointer.io's RSS feed contains ~8 items per week. Each item's `<link>` points to an issue page like `https://pointer.io/archive/2026/05/26`. That page contains links to 10–15 individual blog posts.

Our original RSS pipeline (ADR 002) ingested the issue page itself as the "article." This meant:
- The extracted text was a mashup of 15 article intros + editor commentary
- The embedding represented an average of 15 topics — useless for retrieval
- A 5,000-word issue page was silently truncated by the embedding API's ~2048 token limit
- We were storing ~8 stubs when we could have been storing ~100 individual articles

We needed to detect these "roundup/issue" RSS items and extract the individual article links from the HTML.

## Decision

We built a two-layer classification and extraction system:

### Layer 1: `classifyItem()` — Detect Roundup vs. Direct Article

For each RSS item, we examine `content:encoded` (the full HTML body of the RSS entry):

1. **Parse external links:** Extract all `<a href="...">` tags whose URLs are external (different domain from the RSS feed)
2. **Filter noise:** Remove same-domain links, social media, sponsor URLs, images, `mailto:` links
3. **Threshold:** If `>= 3` external article links are found → classify as `"roundup"`; otherwise `"direct"`

**Why `content:encoded` and not just `link`?**
- Some RSS feeds use `link` for the issue page but put the individual article links inside `content:encoded`
- Other feeds put the direct article URL in `link` with no `content:encoded`
- Examining both gives us the most signal

### Layer 2: `extractArticleLinksFromPage()` — Deep Link Extraction

For roundups, we fetch the issue page HTML and extract individual article URLs:

1. **Fetch HTML** via standard `fetch()`
2. **Run Readability** to get the main content area (strips nav, footer, ads)
3. **Find all `<a>` tags** in the cleaned content
4. **Filter aggressively:**
   - Same-domain links ( Pointer.io linking to pointer.io/sponsor )
   - Known sponsor domains ( WorkOS, Unblocked, PlanetScale, etc. )
   - Social media URLs (twitter.com, linkedin.com, facebook.com)
   - Image/file URLs (.jpg, .png, .pdf)
   - Mailto links
   - URLs without a valid TLD
5. **Deduplicate** via `Set`
6. **Return** a list of `{ url, title? }` objects

**Why Readability before link extraction?**
- Raw HTML contains nav bars, sidebars, footers with dozens of irrelevant links
- Readability isolates the "main content" which in a newsletter issue page is the curated article list
- This dramatically improves signal-to-noise ratio

### Layer 3: Ingest Each Extracted Article

For each extracted URL:

1. **Deduplicate** against existing `articles` table (by URL)
2. **Run the full article pipeline** (ADR 004's extraction redesign):
   - Mozilla Readability extraction
   - Metadata enrichment (Open Graph, JSON-LD)
   - Quality gate (reject cookie walls, <500 char stubs, <5 sentences)
   - Content-hash dedup (SHA-256)
   - Paragraph-aware chunking
   - Per-chunk embedding with `RETRIEVAL_DOCUMENT` task type
3. **Store** article + chunks in DB

### Source-Specific Link Filtering

Real-world newsletter issue pages contain sponsor links, webinar registrations, and job postings mixed with real articles. We added a **domain-based blocklist** and **keyword-based heuristics**:

```typescript
const SPONSOR_KEYWORDS = [
  "workos", "unblocked", "planetscale", "retool",
  "webinar", "register now", "sponsored", "careers",
  "jobs", "hiring", "apply now"
];
```

**Note:** This list is maintained manually based on observed feeds. A future enhancement could use ML-based classification or per-source configuration.

## Results

| Feed | Before | After |
|------|--------|-------|
| Pointer.io | 8 issue stubs | 106 individual articles |
| Software Lead Weekly | 1 issue stub | ~15 individual articles |

The article corpus quality improved dramatically:
- **Retrieval precision:** Each article now has a focused topic embedding instead of a diluted 15-topic average
- **Chunk-level relevance:** Individual article chunks match queries precisely
- **Corpus size:** 10x increase in high-quality articles from curated newsletters

## Consequences

### Positive

- **Massive corpus expansion:** One RSS feed now yields 10–15x more usable articles
- **Focused embeddings:** Individual articles embed better than issue-page mashups
- **Quality gate still applies:** Extracted links go through the same pipeline as manual ingests
- **No schema changes:** Purely application-layer improvement

### Negative / Trade-offs

- **Sponsor link leakage:** Some sponsor URLs still slip through the filter. The manual blocklist requires maintenance as new sponsors appear.
- **403 errors on some sites:** DoorDash careers blog, some Substack paywalls, and other protected sites return 403. We currently skip them; a Playwright or Firecrawl fallback could help.
- **Increased API calls:** 1 RSS item → 1 fetch (issue page) + N fetches (individual articles) + N embedding calls. At ~$0.15/1M tokens for Gemini embeddings, this is still essentially free.
- **RSS feed latency:** A single issue page with 15 links now triggers 15 sequential article fetches. This is fine for manual syncs but could be slow for large automated batches. Parallel fetching with concurrency limits is a future optimization.

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Parse RSS `link` only, never fetch issue pages | Would miss 90% of curated newsletter content. Issue pages are the primary distribution format. |
| Use RSS `guid` as the article URL | `guid` is often a non-URL identifier or the issue page URL. Unreliable. |
| Skip Readability, extract links from raw HTML | Raw HTML contains 50–100 links (nav, sidebar, footer, ads). Readability reduces this to 10–20 relevant links. |
| Store issue page + link list as a single "article" | Embedding a page with 15 topics produces a meaningless average vector. Chunking helps but the content is still a mashup. |
| Use a ML classifier to detect roundups | Overkill for the current scale. The `>= 3 external links` heuristic is accurate for all observed feeds. |

## Related Files

- `app/(app)/sources/rss-actions.ts` — `syncRSSFeed()`, `classifyItem()`, `extractArticleLinksFromPage()`
- `lib/article-extractor.ts` — Readability extraction + link extraction utilities
- `lib/chunker.ts` — Paragraph-aware chunking for extracted articles
- `lib/gemini.ts` — Task-typed embeddings for chunks
- `docs/adr/002-rss-auto-fetching-system.md` — Base RSS sync architecture
- `docs/adr/003-smarter-article-retrieval.md` — Chunk-level retrieval that benefits from this corpus expansion

## Known Issues

1. **SWLW/Pointer sponsor links** — WorkOS, Unblocked, PlanetScale sponsor URLs occasionally slip through. Need per-source allow/block lists (Ticket #? — create if not exists).
2. **403 errors** — Some sites (DoorDash careers, paywalled Substacks) block `fetch()`. May need Playwright fallback or Firecrawl integration.
3. **Quality gate aggressiveness** — Some short but valuable articles (< 500 chars) get rejected. Consider making threshold configurable per source.

## Future Work

- Per-source link filtering configuration (allow/block lists in DB)
- Parallel fetching with concurrency limits for large roundups
- Playwright fallback for JS-rendered or blocked sites
- RSS auto-polling scheduler (Ticket #14) — cron endpoint exists at `/api/cron/sync-rss`

## Date

2026-05-29
