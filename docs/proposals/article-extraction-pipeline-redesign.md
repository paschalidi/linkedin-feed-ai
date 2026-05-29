# Proposal: Redesign the Article Extraction & Embedding Pipeline

**Status**: Proposal — ready for implementation by another agent
**Author**: Architecture review
**Date**: 2026-05-29

---

## TL;DR

The current pipeline has **eight critical flaws** that make article retrieval unreliable. The most severe: we embed the entire article as a single 768-dim vector, but `gemini-embedding-001` only accepts ~2048 tokens — so any article over ~1500 words gets silently truncated. Combined with naïve cheerio extraction (which often returns navigation, comment text, or empty strings), this means a non-trivial percentage of the "articles" in the DB are essentially garbage embeddings.

**Recommended solution**: replace cheerio extraction with **Mozilla Readability + jsdom** (already installed!), implement **paragraph-aware chunking** with overlap, embed each chunk separately with the **`RETRIEVAL_DOCUMENT` task type**, and add a **schema migration** to support chunk-level storage. At query time, retrieve top chunks → group by article → optionally rerank.

---

## Part 1: What's Wrong Right Now

### Problem 1: Cheerio Extraction is Naïve and Fragile (HIGH severity)

Current code in `lib/article-extractor.ts`:

```typescript
const selectors = ["article", "[role='main']", "main", ".article-content", ...];
let content = "";
for (const selector of selectors) {
  const element = $(selector);
  if (element.length > 0) {
    content = element.text(); // Grabs ALL text including nav/comments inside
    break;
  }
}
// Fallback: grab every <p> on the page — including navigation, footer, comments
if (!content.trim()) {
  content = $("p").map((_, el) => $(el).text()).get().join("\n\n");
}
```

**Failure modes:**
- Substack, Medium, Ghost, Hashnode, Dev.to, LinkedIn articles, Notion-published pages — none consistently use `<article>` or these CSS classes.
- Many sites have multiple `<article>` elements (related posts, sidebar, etc.) — we grab the first, which is often a "featured posts" widget.
- The "all `<p>` tags" fallback grabs cookie banner copy, footer disclaimers, comment threads, related-post titles.
- React/Vue/Next.js SPAs serve a near-empty initial HTML; the article content loads via JS. Cheerio sees only the shell.
- Cookie-walled sites (most EU news outlets) return GDPR consent screens, not the article.

**What actually gets stored**: a chaotic mix of nav text, article paragraphs, "subscribe to our newsletter" CTAs, footer copyright, and comment threads. This pollutes the embedding badly.

### Problem 2: Whole-Article Embedding (CRITICAL severity)

`lib/gemini.ts`:

```typescript
const result = await model.embedContent(text);  // text = entire article
return embedding.slice(0, 768);
```

**`gemini-embedding-001` accepts max 2048 input tokens (~7,500 chars).** Anything longer is silently truncated by the Google API.

**Implications:**
- A 5,000-word blog post (typical Stratechery, Lenny's Newsletter, etc.) gets cut to ~1,500 words. The conclusions, takeaways, and second half are lost.
- The single embedding represents an **average semantic position** across the whole article. A post titled "Harness engineering for agent productivity" that contains both DevOps content and AI agent content produces a vector somewhere "in the middle" — close to neither cluster.
- This is **why the RAG article was missed** in the user's bug report: the RAG article's whole-article embedding doesn't strongly express "agent + productivity" because those are sub-topics inside a larger article. The mean vector dilutes them.

**Industry standard since 2023**: chunk articles into 200–500 token segments with overlap, embed each chunk, store all chunks. Retrieval finds specific *passages*, not whole-article means.

### Problem 3: Title Extraction is Wrong (MEDIUM severity)

```typescript
const title = $("title").text().trim() || $("h1").first().text().trim() || "Untitled";
```

`<title>` tag is almost always polluted: `"Article Name | Site Name | Tagline"` or `"Site Name - Article Name (2026 Edition) - Sponsored"`. The first `<h1>` may be the site logo, not the article.

**Should use** (in order): `<meta property="og:title">` → `<meta name="twitter:title">` → JSON-LD `headline` → article-scoped `<h1>`.

### Problem 4: No Embedding Task Type (MEDIUM severity)

`gemini-embedding-001` supports task-specific embeddings via the `taskType` parameter:

- `RETRIEVAL_DOCUMENT` — for stored docs
- `RETRIEVAL_QUERY` — for search queries
- `SEMANTIC_SIMILARITY`, `CLASSIFICATION`, `CLUSTERING`, `QUESTION_ANSWERING`, `FACT_VERIFICATION`

Using matched task types (DOCUMENT for ingestion, QUERY for search) improves retrieval quality by **5–15%** ([Google's research](https://arxiv.org/abs/2503.07891)).

**Currently we use neither** — defaults to a generic mode. Both ingestion and query use the same mode, leaving easy quality on the table.

### Problem 5: No Metadata Extraction (LOW–MEDIUM severity)

Modern articles ship rich metadata:
- `<meta property="article:published_time">` — publish date
- `<meta property="article:author">` — author
- JSON-LD `@type: Article` — full structured data
- `<meta name="description">` — summary

Currently: **none extracted**. Lost opportunities:
- Recency boost in retrieval (newer articles often more relevant)
- Author-based filtering ("only show articles by people I follow")
- Pre-summarized snippets for the composer prompt
- Reading time estimation for UX

### Problem 6: No Deduplication by Content (LOW severity)

Same article syndicated across 3 newsletters → 3 copies in DB, 3 embeddings, 3x retrieval noise. The current dedup is by URL only. We should also hash the cleaned content (e.g. SHA-256 of first 1000 chars normalized) and reject duplicates.

### Problem 7: No Quality Gate on Stored Articles (MEDIUM severity)

Right now we'll happily store:
- A 50-word "subscribe to read" stub
- A 404 page that returned 200
- A pure cookie-consent page
- The site homepage instead of the article

There's no minimum content length, no "is this actually an article?" check, no language detection. Garbage articles dilute search quality forever.

### Problem 8: No SPA Support (MEDIUM severity)

A growing share of "blogs" (Notion, Super.so, Framer sites, custom React) render content client-side. `fetch()` returns the JS shell.

**Symptoms in your DB**: articles from these sources will have absurdly short content (just the meta tags + boilerplate) but valid URLs.

---

## Part 2: State-of-the-Art Solution

### High-Level Architecture

```
URL → [Fetch] → [Render if SPA] → [Readability extract]
    → [Metadata enrich] → [Quality gate]
    → [Chunk into passages] → [Embed each chunk with taskType=RETRIEVAL_DOCUMENT]
    → [Store article + chunks]

Query → [Embed with taskType=RETRIEVAL_QUERY]
    → [Match against chunks (top 20)]
    → [Group by article, take best chunk per article]
    → [Optional: rerank top 20 → top 5 with cross-encoder]
    → [Return]
```

### Component 1: Replace Cheerio with Mozilla Readability

`@mozilla/readability` is the same engine that powers Firefox's "Reader View." It's the de-facto standard for content extraction, used by Pocket, Instapaper, Omnivore, and 1000+ others.

**`jsdom` is already installed** in your `package.json` (line 19) but unused — so this is a near-zero-cost upgrade.

**Pseudocode:**

```typescript
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

async function extractWithReadability(url: string, html: string) {
  const dom = new JSDOM(html, { url }); // url enables proper relative-link resolution
  const reader = new Readability(dom.window.document, {
    charThreshold: 500,        // reject articles under 500 chars
    keepClasses: false,        // drop class attrs from output
  });
  const article = reader.parse();
  if (!article) throw new Error("Readability could not extract article");

  return {
    title: article.title,           // Already cleaned, removes site suffix
    byline: article.byline,          // Author
    content: article.textContent,    // Plain text — clean
    contentHtml: article.content,    // Cleaned HTML if you want structure
    excerpt: article.excerpt,        // First paragraph summary
    siteName: article.siteName,
    length: article.length,          // Char count
    lang: article.lang,
  };
}
```

**Add as install step:**
```bash
npm install @mozilla/readability
```

### Component 2: Metadata Enrichment Layer

Extract canonical metadata from Open Graph, Twitter cards, and JSON-LD before falling back to Readability output:

```typescript
function extractMetadata(dom: JSDOM) {
  const doc = dom.window.document;
  const meta = (name: string) =>
    doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)
      ?.getAttribute("content");

  // JSON-LD (most reliable)
  const jsonLd = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    .map(s => { try { return JSON.parse(s.textContent ?? ""); } catch { return null; } })
    .filter(Boolean)
    .find(d => d?.["@type"] === "Article" || d?.["@type"] === "BlogPosting");

  return {
    title: jsonLd?.headline ?? meta("og:title") ?? meta("twitter:title"),
    description: jsonLd?.description ?? meta("og:description") ?? meta("description"),
    publishedAt: jsonLd?.datePublished ?? meta("article:published_time"),
    author: jsonLd?.author?.name ?? meta("article:author") ?? meta("author"),
    image: meta("og:image"),
    canonicalUrl: doc.querySelector('link[rel="canonical"]')?.getAttribute("href"),
  };
}
```

### Component 3: SPA Rendering Fallback

For JS-rendered sites, fall back to Playwright (already installed as `@playwright/test`).

**Detection heuristic**: if Readability extraction returns `content.length < 500` AND the HTML contains `<div id="root">` or `<div id="__next">` or similar React/Vue mount points, retry with Playwright.

```typescript
import { chromium } from "playwright";

async function fetchWithBrowser(url: string): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
  const html = await page.content();
  await browser.close();
  return html;
}
```

**Caveats**:
- Playwright needs `npx playwright install chromium` once after deploy. Add to build step.
- 5–10x slower than `fetch`. Only use as fallback.
- Doesn't work on Vercel serverless without [`@sparticuz/chromium`](https://github.com/Sparticuz/chromium). Document this in deploy notes.

**Alternative**: use a hosted scraper API for hard cases — [ScrapingBee](https://www.scrapingbee.com/), [Browserless](https://browserless.io/), [Firecrawl](https://firecrawl.dev/). Firecrawl in particular has a clean Markdown output endpoint that handles all of this.

### Component 4: Quality Gate

Before storing, validate:

```typescript
function validateArticle(article: ExtractedArticle): { ok: boolean; reason?: string } {
  if (!article.content) return { ok: false, reason: "empty content" };
  if (article.content.length < 500) return { ok: false, reason: "too short (< 500 chars)" };
  if (article.content.length > 200_000) return { ok: false, reason: "too long (> 200k chars)" };

  // Detect cookie-wall / paywall pages
  const lower = article.content.toLowerCase();
  const wallKeywords = ["accept all cookies", "subscribe to read", "create a free account to read", "this article is for paid subscribers"];
  if (wallKeywords.some(k => lower.includes(k)) && article.content.length < 2000) {
    return { ok: false, reason: "looks like a cookie/paywall stub" };
  }

  // Reject pages that are mostly navigation
  const sentences = article.content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  if (sentences.length < 5) return { ok: false, reason: "too few real sentences" };

  return { ok: true };
}
```

### Component 5: Paragraph-Aware Chunking with Overlap

This is the most impactful change. State of the art (LangChain, LlamaIndex, Pinecone) is **recursive character text splitting** that respects paragraph and sentence boundaries.

**Recommended approach:**

```typescript
interface Chunk {
  text: string;
  index: number;       // 0-based position in article
  charStart: number;   // for source highlighting later
  charEnd: number;
}

function chunkArticle(content: string, options = {
  targetChars: 1500,        // ~400 tokens — well under 2048 limit, leaves room for query expansion
  overlapChars: 200,        // 13% overlap preserves context across boundaries
  minChunkChars: 300,       // don't store tiny last-chunk fragments
}): Chunk[] {
  const paragraphs = content.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const chunks: Chunk[] = [];
  let buffer = "";
  let bufferStart = 0;
  let cursor = 0;

  for (const para of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${para}` : para;

    if (candidate.length <= options.targetChars) {
      buffer = candidate;
    } else {
      // Flush current buffer as chunk
      if (buffer.length >= options.minChunkChars) {
        chunks.push({
          text: buffer,
          index: chunks.length,
          charStart: bufferStart,
          charEnd: bufferStart + buffer.length,
        });
      }
      // Start next buffer with overlap from end of previous
      const overlapStart = Math.max(0, buffer.length - options.overlapChars);
      const overlap = buffer.slice(overlapStart);
      bufferStart = bufferStart + overlapStart;
      buffer = overlap ? `${overlap}\n\n${para}` : para;
    }
    cursor += para.length + 2;
  }

  // Flush final buffer
  if (buffer.length >= options.minChunkChars) {
    chunks.push({
      text: buffer,
      index: chunks.length,
      charStart: bufferStart,
      charEnd: bufferStart + buffer.length,
    });
  }

  return chunks;
}
```

**Why this is good**:
- **Paragraph boundaries respected**: chunks don't split mid-thought.
- **Overlap preserves context**: if a key sentence sits at a boundary, both adjacent chunks contain it.
- **Stays under embedding token limit** with comfortable margin.
- **Tunable**: bump to 2000 chars for denser articles, drop to 800 for tweet-thread-style content.

**Production-grade alternative**: `langchain/text_splitter`'s `RecursiveCharacterTextSplitter` does this with multi-level fallback (paragraph → sentence → word → char). Worth installing if chunking quality matters more than dependency size.

### Component 6: Task-Typed Embeddings

```typescript
// Ingestion
const result = await model.embedContent({
  content: { parts: [{ text: chunk.text }] },
  taskType: "RETRIEVAL_DOCUMENT",
  title: article.title,  // Boosts retrieval quality further
});

// Query (in retrieveRelevantArticles)
const result = await model.embedContent({
  content: { parts: [{ text: ideaText }] },
  taskType: "RETRIEVAL_QUERY",
});
```

The `title` parameter on document embedding is a documented quality boost — it conditions the embedding on which article the chunk belongs to.

### Component 7: Schema Migration

Current: one row per article in `articles` with one `embedding`.

**New schema:**

```sql
-- Articles store metadata only (no embedding)
ALTER TABLE articles
  ADD COLUMN author TEXT,
  ADD COLUMN published_at TIMESTAMPTZ,
  ADD COLUMN excerpt TEXT,
  ADD COLUMN content_hash TEXT,         -- for dedup
  ADD COLUMN canonical_url TEXT,
  ADD COLUMN site_name TEXT,
  ADD COLUMN char_count INT,
  ADD COLUMN extraction_method TEXT;     -- 'readability' | 'playwright' | 'manual'
ALTER TABLE articles DROP COLUMN embedding;  -- Move to chunks table

CREATE UNIQUE INDEX articles_content_hash_idx ON articles(content_hash);

-- Chunks are embedded separately
CREATE TABLE article_chunks (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,             -- ordering within article
  text TEXT NOT NULL,
  char_start INT NOT NULL,
  char_end INT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, chunk_index)
);

CREATE INDEX article_chunks_embedding_idx
  ON article_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX article_chunks_article_id_idx ON article_chunks(article_id);
```

### Component 8: New `match_articles` Function

Retrieve at chunk level, then group:

```sql
CREATE OR REPLACE FUNCTION match_articles(
  query_embedding real[],
  match_threshold FLOAT DEFAULT 0.0,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id TEXT,
  source_id TEXT,
  title TEXT,
  url TEXT,
  excerpt TEXT,
  best_chunk TEXT,                  -- the highest-scoring chunk
  best_chunk_index INT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  WITH ranked_chunks AS (
    SELECT
      c.article_id,
      c.text AS chunk_text,
      c.chunk_index,
      1 - (c.embedding <=> query_embedding::vector(768)) AS chunk_similarity,
      ROW_NUMBER() OVER (
        PARTITION BY c.article_id
        ORDER BY c.embedding <=> query_embedding::vector(768)
      ) AS rn
    FROM article_chunks c
    WHERE 1 - (c.embedding <=> query_embedding::vector(768)) > match_threshold
  )
  SELECT
    a.id,
    a.source_id,
    a.title,
    a.url,
    a.excerpt,
    rc.chunk_text AS best_chunk,
    rc.chunk_index AS best_chunk_index,
    rc.chunk_similarity AS similarity
  FROM ranked_chunks rc
  JOIN articles a ON a.id = rc.article_id
  WHERE rc.rn = 1                   -- best chunk per article
  ORDER BY rc.chunk_similarity DESC
  LIMIT match_count;
$$;
```

**Why this is much better**:
- Returns the *specific passage* that matched, not the whole article.
- The composer prompt can include the best chunk + 1 chunk before/after for context, instead of `content.slice(0, 2000)`.
- A long article still gets a fair shot — its best paragraph competes on equal footing with short articles' embeddings.

### Component 9: Optional Reranking (Phase 2)

For top-tier quality, after retrieving top-20 chunks, rerank with a cross-encoder:

- **Cohere Rerank API** (`rerank-3.5`) — cheap (~$2/1k queries), accurate, easy
- **BGE Reranker** (open source, self-hosted) — free but needs GPU/CPU compute
- **Voyage rerank-2** — best benchmark scores, $0.05/1k queries

A reranker scores `(query, chunk)` pairs jointly with a cross-attention model — this catches nuance pure vector similarity misses (which is exactly the "Harness engineering" disambiguation problem).

**Effort**: 50 lines of code if using a hosted API. Significant retrieval quality bump.

---

## Part 3: Migration Plan

A pragmatic ordering for the implementing agent:

### Phase 1 — Extraction (Highest impact, lowest risk)
1. Install `@mozilla/readability`.
2. Replace `lib/article-extractor.ts` with Readability + jsdom + metadata extraction.
3. Add the quality gate.
4. **Re-ingest all existing articles** with the new extractor (their current content is likely degraded). The `articles.content` column gets overwritten.
5. Re-run embeddings against the new content (still whole-article for now).

### Phase 2 — Chunking & Schema
1. Schema migration: add `article_chunks` table, add metadata columns to `articles`, drop `articles.embedding`.
2. Implement chunking utility.
3. Update `ingest-actions.ts` and `rss-actions.ts` to: extract → chunk → embed-each-chunk → insert article + chunks.
4. Update `match_articles` to query chunks.
5. Update `compose/actions.ts` to use the new chunk-aware retrieval (uses `best_chunk` instead of full `content` for the LLM prompt).

### Phase 3 — Task Types & SPA
1. Add `taskType` parameter to all `embedContent` calls.
2. Add Playwright fallback for SPA detection.
3. Add `extraction_method` tracking to know which articles came from each path.

### Phase 4 — Reranking (optional, polish)
1. Sign up for Cohere/Voyage.
2. Wrap retrieval with a rerank step on top-20 → top-5.
3. Measure quality improvement on the existing "Harness engineering" test case.

---

## Part 4: Testing the Fix

The user's bug report ("Harness engineering" missed the RAG article) is the perfect regression test.

After implementing Phase 1 + 2:

1. Re-ingest both articles with Readability.
2. Both should chunk into 3–8 passages each.
3. The RAG article should have at least one chunk that's specifically about "agent productivity" or "RAG patterns."
4. Querying "Harness engineering harnessing your agent productivity without latest models" should now match that specific RAG chunk with high similarity, even if the article-level mean would have been low.

Add a test:

```typescript
// tests/retrieval-quality.test.ts
test("Harness engineering query retrieves both relevant articles", async () => {
  const articles = await retrieveRelevantArticles(
    "Harness engineering: how harnessing your agent boosts productivity without latest models"
  );
  expect(articles.map(a => a.title)).toEqual(
    expect.arrayContaining([expect.stringMatching(/harness/i), expect.stringMatching(/rag/i)])
  );
});
```

---

## Part 5: Cost & Performance Notes

- **Embedding costs**: chunking multiplies embedding API calls. A 5,000-word article → ~5 chunks → 5x calls. At `gemini-embedding-001`'s ~$0.15/1M tokens, this is still functionally free for personal use (~$1/year for 10,000 articles).
- **Storage**: 768-dim vector ≈ 3KB. 10,000 articles × 5 chunks = 50,000 vectors = 150MB. Negligible.
- **Query latency**: chunked retrieval is *faster* than article-level (smaller texts to compare). HNSW/IVFFlat index handles scale fine to millions of chunks.
- **Playwright**: only adds latency on fallback path. Cache aggressively (don't refetch the same URL within 7 days).

---

## Recommended Libraries (final list)

| Purpose | Library | Why |
|---------|---------|-----|
| HTML parsing for Readability | `jsdom` | Already installed |
| Article extraction | `@mozilla/readability` | De facto standard; powers Firefox Reader View |
| SPA fallback (optional) | `@playwright/test` (already installed) or `firecrawl` | Playwright is already a dep; Firecrawl if you want to skip running browsers in serverless |
| Chunking | Custom (above) or `langchain/text_splitter` | Custom is 60 lines; LangChain if you want recursive multi-separator fallback |
| Reranking (Phase 4) | Cohere Rerank `rerank-3.5` | Cheapest hosted option, drop-in API |

---

## What NOT to Do

- **Don't** use the OpenAI `text-embedding-3-large` "as a quick fix." The model isn't the problem; the pipeline is.
- **Don't** skip chunking and just truncate to 2000 chars. You'll lose the conclusions of every long article.
- **Don't** store `article.content` as raw HTML. Store cleaned plain text + optional cleaned HTML in a separate column if you want rich rendering later.
- **Don't** roll your own boilerplate detection. Readability has been refined for 15 years across Mozilla, Pocket, Instapaper, etc.
- **Don't** keep the current `match_threshold: 0.3` after switching to chunks. Chunk-level similarity scores are *higher* on average (smaller texts compare more precisely), so you'll need to recalibrate. Start at `0.5` for chunked retrieval, tune based on real queries.

---

## Out of Scope

These are real problems but not in this proposal:
- Multilingual support (current pipeline assumes English)
- Image/diagram extraction from articles
- PDF source ingestion
- Real-time deduplication across feeds (we currently dedup at insert; a content-hash unique index will handle most of it)
- LinkedIn-specific content extraction (their HTML is intentionally hostile to scrapers)
