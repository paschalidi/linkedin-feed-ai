# ADR 007: Surprise Me — AI-Generated Ideas from Saved Articles

## Status
Accepted

## Context
Users need a steady stream of fresh content ideas. Manual ideation is draining and often stalls. We have a growing corpus of ingested newsletter articles in the database, but users were not mining them for post-worthy themes. We needed an autonomous agent that could read the articles, spot patterns, and propose original ideas — not summaries, but angles.

## Decision
Build a **"Surprise Me"** feature that:

1. Fetches a **random sample** of saved articles from the database on every invocation (not the same 30 newest).
2. Sends titles + short excerpts to Gemini (`gemini-2.5-flash-lite`).
3. Prompts the model to act as a **senior tech editor** who spots hidden threads across articles.
4. Requires **strict JSON output** with a punchy title and an angle description.
5. Saves the result as a new `DailyIdea` with status `draft`.

### Why Gemini flash-lite?
- Fast response time (the user waits for this interaction).
- Sufficient quality for ideation (does not need the heavy reasoning model).
- Higher free-tier quota than `flash`.

### Why random sampling instead of "last 30"?
- If we always send the newest 30 articles, the model sees the same corpus every time.
- Random sampling ensures variety: old articles get resurfaced, new combinations emerge.
- The user gets genuinely different ideas on each click.

### Prompt design
The prompt explicitly forbids summarization:

> "Do NOT summarize them. Instead: identify 2-3 underlying themes, tensions, or counter-intuitive insights... Pick the ONE theme that would make the most compelling, original LinkedIn post. Frame it as a practitioner's hot take."

This forces the model to **synthesize**, not **regurgitate**.

### Output contract
Strict JSON with two fields:
- `title`: 5–10 words, punchy, specific
- `description`: 2–3 sentences on the tension/angle — why a practitioner would care

If the model wraps the JSON in markdown fences, we strip them before parsing.

## Consequences

### Positive
- Users get original ideas without reading dozens of articles themselves.
- The random sampling keeps the feature fresh even with a static article corpus.
- Ideas are framed as "hot takes" — ready to drop into the composer and generate a post.

### Negative
- Quality depends on the diversity of the article corpus. If all articles are about the same narrow topic, ideas will feel repetitive.
- No deduplication: the model might generate a similar idea twice. We accept this for simplicity; the user can archive duplicates.
- No persistence of which articles were used for which idea. This means we cannot trace an idea back to its source articles later.

## Alternatives considered

1. **Semantic clustering** — group articles by embedding similarity, then pick a cluster. Rejected: over-engineered for MVP; random sampling is simpler and produces sufficient variety.
2. **Weekly digest** — auto-generate one idea per week via cron. Rejected: user wants on-demand ideation, not scheduled.
3. **Per-article idea** — generate one idea per article. Rejected: produces shallow, summary-style ideas. Cross-article synthesis yields stronger angles.

## Related
- ADR 003: Core Data Model (Article, DailyIdea tables)
- ADR 006: LinkedIn Profile Style Cloning (uses same Gemini client)
