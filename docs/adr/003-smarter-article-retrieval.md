# ADR 003: Smarter Article Retrieval with Dynamic Thresholds and Preview

## Status

Accepted

## Context

The composer uses semantic search (`match_articles` via pgvector cosine distance) to find relevant articles from the vector DB. A user reported a real-world failure:

- **Idea**: "Harness engineering" (title) with description about "harnessing your agent to boost productivity without latest models"
- **Articles in DB**: 2 total — one about "Harness" (DevOps platform) and one about "RAG" (AI/LLM retrieval)
- **Expected**: Both articles should be used, since the idea is actually about AI agents, not the DevOps platform
- **Actual**: Only the "Harness" article was returned. The RAG article was filtered out by the `match_threshold: 0.3`.

**Root cause analysis:**
1. **Aggressive threshold**: With only 2 articles in the corpus, a threshold of 0.3 is too high. The RAG article's cosine similarity to the query "Harness engineering..." was below 0.3 because "Harness" as a proper noun dominates the embedding, pushing the RAG article's vector far away.
2. **No fallback mechanism**: When vector search returns very few results, there was no keyword or broader search to catch semantically related but not identical articles.
3. **Opaque retrieval**: The user never saw which articles were selected until after generation, making it impossible to spot missing sources.

## Decision

We redesigned the retrieval layer with three improvements:

### 1. Dynamic Similarity Threshold Based on Corpus Size

The `retrieveRelevantArticles` function now queries the total article count first, then adjusts its strategy:

```javascript
const threshold = totalArticles < 10 ? 0.0 : totalArticles < 50 ? 0.15 : 0.3;
const limit = Math.min(10, totalArticles);
```

| Corpus Size | Threshold | Rationale |
|-------------|-------------|-----------|
| < 10 | 0.0 | Return everything. With a tiny corpus, filtering loses more signal than noise. |
| 10–50 | 0.15 | Mild filtering. Catches related topics even if not exact semantic matches. |
| > 50 | 0.3 | Standard threshold. With a large corpus, low-similarity results are mostly noise. |

This directly fixes the reported bug: with 2 articles, both are now returned.

### 2. Keyword Fallback Search

If vector search returns fewer than 3 results and there are more articles in the DB, a keyword search runs as a fallback:

- Extract keywords from the idea text (filtering out stop words)
- Query `articles` with `title.ilike.%keyword%` OR `content.ilike.%keyword%`
- Merge results, avoiding duplicates, with a dummy low similarity score (0.01)

This catches articles that mention related concepts (e.g., "agent", "RAG", "productivity") even when their overall embedding vector is distant from the query.

### 3. Two-Step Composer UX with Source Preview

The composer page now has a two-step flow:

1. **Step 1 — Select**: User picks ideas + style, then clicks "Find Relevant Sources"
2. **Step 2 — Preview**: The system shows the retrieved articles with their similarity scores (e.g., "85% match"). The user can see exactly what informed the search.
3. **Step 2 — Generate**: User clicks "Generate LinkedIn Post" to proceed.

This makes the retrieval transparent and gives users confidence that the right sources were found (or alerts them when sources are missing).

**Implementation:**
- `previewSources(formData)` — server action that returns articles without generating
- `generatePost(formData)` — server action that generates and stores the post
- `ComposeForm` — client component managing the two-step state

## Consequences

### Positive

- **Tiny corpora now work correctly**: With < 10 articles, nothing is arbitrarily filtered out.
- **Keyword fallback catches edge cases**: When embeddings fail to capture conceptual similarity (e.g., "Harness" vs "harnessing"), keyword matching provides a safety net.
- **Transparency**: Users see which articles informed their post before generation, building trust in the system.
- **No schema changes**: Purely application-layer improvements.

### Negative / Trade-offs

- **Keyword fallback can introduce noise**: If a keyword is common (e.g., "the", "model"), the ILIKE search might return irrelevant articles. The stop-word filter mitigates this, but it's not perfect.
- **Two-step flow adds friction**: One extra click before generation. We accepted this because the transparency benefit outweighs the slight UX slowdown.
- **Keyword search bypasses the vector index**: The ILIKE fallback uses sequential scans on `title` and `content`, which is fine for small corpora (< 1000 articles) but would need full-text search (PostgreSQL `tsvector`) at scale.
- **Similarity scores are not calibrated**: The `match_articles` function returns `1 - cosine_distance`, which is technically correct but doesn't map to "85% relevant" in human terms. The UI shows it as a rough guide only.

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Lower threshold globally to 0.0 | Would return noise in large corpora (> 100 articles). Dynamic threshold scales appropriately. |
| LLM-based query expansion before embedding | Ask an LLM to rewrite "Harness engineering" → "AI agents, RAG, productivity". Would help disambiguation but adds latency and cost on every compose. Deferred. |
| Two-stage retrieval with LLM re-ranking | Retrieve top 20, then ask LLM to pick the best 5. Adds significant cost and latency. Overkill for current scale. |
| Show articles only after generation | Current behaviour. Rejected because users can't spot missing sources until it's too late. |
| Add a `relevance_score` column and manual rating | Would require building a training pipeline. Too complex for current stage. |

## Related Files

- `app/(app)/compose/actions.ts` — `retrieveRelevantArticles()`, `previewSources()`, `generatePost()`
- `app/(app)/compose/compose-form.tsx` — Two-step client component
- `app/(app)/compose/page.tsx` — Server component wiring
- `prisma/migrations/*/migration.sql` — `match_articles()` SQL function

## Date

2026-05-29
