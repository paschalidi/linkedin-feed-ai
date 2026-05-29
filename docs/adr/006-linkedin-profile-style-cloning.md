# ADR 006: LinkedIn Profile Style Cloning

## Status

Accepted

## Context

The app generates LinkedIn posts using a user-provided "style profile" — a natural language description of their writing voice (e.g., "Short paragraphs, confident tone, bullet points..."). While this works, it requires the user to be self-aware enough to describe their own voice in prose. Most people can't.

We want to let users clone the voice of 10–15 LinkedIn creators they admire instead. The flow is:
1. Paste 10–15 LinkedIn profile URLs
2. Fetch their public posts
3. Distill their writing patterns into a style guide
4. Generate posts in that cloned voice

We evaluated how to:
- **Scrape** LinkedIn profiles for public posts
- **Represent** a writing voice from a corpus of posts
- **Apply** that voice at generation time
- **Sync** posts as the target profiles publish new content

## Decision

We built a 4-stage pipeline: **Scrape → Store → Fingerprint → Generate**. Each stage is an independently shippable PR.

### Stage 1: Scrape (Apify)

We use **Apify** to fetch public LinkedIn posts from a profile URL:

- **Actor:** `scraper-engine~linkedin-profile-post-scraper` (or equivalent reliable actor from Apify Store)
- **Cost:** ~$0.01 per profile per sync
- **Input:** Profile URL (e.g., `https://linkedin.com/in/johndoe`)
- **Output:** Array of `{ text, postedAt, engagement, url }`
- **Resync:** Manual via "Resync" button; no auto-scheduler for MVP

**Why Apify over alternatives:**

| Service | Cost | Reliability | Effort | Verdict |
|---------|------|-------------|--------|---------|
| Apify | $0.01/use | High (rotating proxies) | Low | **Chosen** |
| RapidAPI | $10–50/mo | Medium (unstable endpoints) | Low | Rejected |
| Bright Data | $500/mo+ | Very high | Medium | Rejected (overkill for MVP) |
| DIY Playwright | $0 | Low (LinkedIn blocks datacenter IPs) | High | Rejected |

### Stage 2: Store

Scraped posts are stored in the existing `linkedin_profiles` table. We added two columns:

| Field | Type | Purpose |
|-------|------|---------|
| `lastSyncedAt` | `DateTime?` | When this profile was last resynced |
| `postCount` | `Int?` | Number of posts currently stored |

`posts_json` stores:
```json
[
  {
    "text": "Post content...",
    "postedAt": "2026-04-15T10:00:00Z",
    "engagement": { "likes": 234, "comments": 12 },
    "url": "https://linkedin.com/posts/..."
  }
]
```

### Stage 3: Fingerprint (Claude analysis)

Users click **"Generate Fingerprint"** on the `/styles` page. The app:

1. **Samples** 30 random posts across all stored profiles
2. **Sends** them to Claude with a structured analysis prompt
3. **Receives** a markdown style guide (e.g., "Uses short punchy sentences. Opens with contrarian hooks...")
4. **Saves** the result as a `StyleProfile` named "Cloned Voice"
5. **Marks** the profile with `isClonedVoice: true` so the compose flow knows to enrich it with examples

**The analysis prompt extracts:**
- Average post length and paragraph count
- Sentence structure patterns
- Common opening hooks
- Formatting conventions (whitespace, bullets, emojis)
- Tone (confident / vulnerable / contrarian / educational)
- Vocabulary register (formal / casual / technical)
- Use of data, numbers, specifics
- Storytelling patterns
- Closing conventions (CTA, summary, question)
- Anti-patterns (clichés avoided)

**Why Claude over Gemini for analysis:**
- Claude excels at literary analysis and pattern extraction from unstructured text
- Gemini is retained for fast/cheap post generation (10 posts/day)
- The analysis runs rarely (once per user action), so cost is negligible

### Stage 4: Generate (few-shot enrichment)

When a user composes a post with the "Cloned Voice" style selected:

1. The **existing** compose flow runs (idea + style profile + article context)
2. The app **detects** that the style is a cloned voice (`isClonedVoice: true`)
3. It **samples** 3 random posts from the stored corpus
4. It **injects** them as few-shot examples into the system prompt:

```
[existing prompt with style guide]

EXAMPLES OF THE TARGET VOICE (study these — your output should feel
like it was written by the same person):

Example 1:
[sample post 1]

Example 2:
[sample post 2]

Example 3:
[sample post 3]
```

**Why combine style guide + few-shot examples:**

| Approach | Strength | Weakness |
|----------|----------|----------|
| Style guide only | Cheap, compact prompt | May be too generic, misses subtleties |
| Few-shot only | Captures exact patterns | Expensive tokens, doesn't generalize |
| **Both combined** | **Generalizable + specific** | Slightly more tokens (still well within limits) |

The combined approach is the industry-standard technique for voice cloning in LLM pipelines.

### Profile grouping

We chose **one combined style** across all profiles rather than per-profile styles:
- The user curates the voice by choosing which 10–15 profiles to add
- "Cloned Voice" is the blended fingerprint of the entire corpus
- Simpler UX: one button generates one style, one style to select in compose
- Can be extended to multiple named fingerprints later (e.g., "VC Voice" vs "Engineer Voice")

### Resync strategy

- **Manual only** for MVP: user clicks "Resync" on a profile when they want fresh data
- No cron/scheduler — avoids ongoing cost and complexity
- Future: auto-resync weekly using the existing `/api/cron/sync-rss` pattern

## Schema Changes

Added to `linkedin_profiles`:

| Field | Type | Purpose |
|-------|------|---------|
| `lastSyncedAt` | `DateTime?` | Last successful Apify scrape |
| `postCount` | `Int?` | Cached count of stored posts |

Added to `style_profiles`:

| Field | Type | Purpose |
|-------|------|---------|
| `isClonedVoice` | `Boolean` @default(false) | Whether this profile should trigger few-shot enrichment |

## Configuration

New environment variable in `.env.local`:

```bash
APIFY_API_TOKEN=your_apify_api_token
```

Obtained from Apify Console → Integrations → API.

## UI Changes

On the `/styles` page, below existing manual style profiles:

- **Section header:** "LinkedIn Style Cloning"
- **Add profile input:** URL text field + "Add Profile" button
- **Profile list:** Cards showing name, post count, last sync date, Resync / Remove buttons
- **Generate Fingerprint button:** Runs Claude analysis on all stored posts
- **Fingerprint preview:** Collapsible markdown preview of the generated style guide
- **Edit link:** Opens the generated StyleProfile in the existing editor

## Consequences

### Positive

- **No need to describe your own voice:** Users clone creators they admire instead of writing a style guide from scratch
- **Better voice matching than manual profiles:** The LLM sees actual examples, not abstractions
- **Composable:** Users can mix profiles (e.g., 5 VC voices + 5 engineer voices) to create hybrid voices
- **Cheap to operate:** ~$0.15 initial scrape, ~$3–5/month at 10 posts/day
- **All existing features unchanged:** Manual style profiles still work; this is additive

### Negative / Trade-offs

- **LinkedIn ToS risk:** Scraping public profiles violates LinkedIn's Terms of Service. Apify uses rotating residential proxies which mitigates risk to the user's account, but the service could be disrupted if LinkedIn aggressively blocks scrapers.
- **Quality depends on target profiles:** If the 10–15 profiles have inconsistent voices, the blended fingerprint will be muddy. Users must curate intentionally.
- **Fingerprint is static until regenerated:** New posts from target profiles are only incorporated when the user clicks "Generate Fingerprint" again. The few-shot examples are sampled fresh on each generation, so they do pick up new posts.
- **Not real-time:** Apify scrape takes 10–30 seconds. The "Add Profile" flow shows a loading state.
- **Apify actor dependency:** If the chosen actor is deprecated, we swap the actor name in `lib/apify.ts` (15-minute change).

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Manual paste (no scraper) | User pastes posts manually. Free but defeats the purpose of easy cloning. Good fallback if Apify fails. |
| RapidAPI third-party endpoints | Unreliable; many endpoints get banned. Subscription model ($10–50/mo) vs Apify pay-per-use. |
| Bright Data proxy + DIY scraper | $500/mo+ for reliable residential proxies. Overkill for a personal tool. |
| Few-shot only (no analysis step) | Each generation would include 5 random posts, making prompts large and expensive. Style guide distillation is a one-time cost. |
| Per-profile styles | More flexible but clutters the compose UI. Users would need to pick which profiles to combine on each post. Chose combined for simplicity; can split later. |
| Auto-resync via cron | Adds ongoing cost and complexity. Manual resync is sufficient for an MVP; can add cron later using existing `/api/cron` pattern. |
| Use Gemini for analysis instead of Claude | Claude's literary analysis is consistently better for extracting writing patterns. Gemini is cheaper but produces more generic style guides in testing. |

## Related Files

- `lib/apify.ts` — Apify Actor API client
- `app/(app)/styles/profile-actions.ts` — Server actions for profile CRUD and fingerprint generation
- `app/(app)/styles/linkedin-profile-list.tsx` — Profile management UI
- `lib/claude.ts` — Claude analysis function (`analyzeWritingStyle()`)
- `lib/prompts.ts` — Style analysis prompt builder
- `app/(app)/compose/actions.ts` — Compose flow with few-shot enrichment
- `app/(app)/posts/actions.ts` — Regenerate flow with few-shot enrichment
- `prisma/schema.prisma` — `lastSyncedAt`, `postCount`, `isClonedVoice` fields

## Known Issues

1. **LinkedIn ToS violation** — Scraping public profiles is against LinkedIn's Terms of Service. Apify mitigates this with rotating proxies, but the service could be disrupted. Documented as an acceptable risk for a personal tool.
2. **Apify actor reliability** — Different actors have different success rates with LinkedIn. We may need to swap actors if the chosen one degrades.
3. **Fingerprint quality varies** — The style guide quality depends heavily on the prompt and the corpus. Generic or inconsistent target profiles produce muddy fingerprints. Users can manually edit the generated guide.
4. **Token budget for few-shot** — Three full LinkedIn posts can be 3000–6000 chars. This is well within Claude's 200K context and Gemini's 1M context, but we truncate examples to ~500 chars each as a safety measure.
5. **No engagement weighting** — All posts are treated equally. A post with 10K likes gets the same weight as one with 10 likes. Future enhancement: weight examples by engagement to prioritize viral content.

## Future Work

- **Multiple named fingerprints** — Allow users to create "VC Voice," "Engineer Voice," etc. by grouping different profile sets
- **Per-profile styles** — Let users pick individual profile voices in compose (advanced mode)
- **Auto-resync via cron** — Weekly automatic refresh using existing `/api/cron/sync-rss` infrastructure
- **Engagement-weighted sampling** — Prioritize high-engagement posts in the few-shot pool
- **Comment style cloning** — Extend to scraping and cloning comment/reply style
- **Email/newsletter author cloning** — Use the same fingerprint pipeline for Substack authors, newsletter writers, etc.
- **A/B test voice quality** — Compare posts generated with style guide only vs. style guide + few-shot to quantify improvement

## Date

2026-05-29
