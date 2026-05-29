# Plan: LinkedIn Profile Style Cloning

**Status:** Planning
**Goal:** Add 10–15 LinkedIn profile URLs → fetch their posts → distill into a style fingerprint → generate posts that match that voice.
**Resolves:** Ticket #7 (LinkedIn Profile Scraping) + new "style cloning" feature

---

## Decisions (confirmed)

| Decision | Choice |
|----------|--------|
| Scraping service | **Apify** (pay-per-use, ~$0.01/profile) |
| Style approach | **Distilled style guide + few-shot examples** (best voice matching) |
| Profile grouping | **One combined style** across all profiles |
| Resync strategy | **Manual resync only** (button click) |

---

## Final Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  /styles page (existing — gets new section)                    │
│                                                                 │
│  ── Existing: Manual style profiles ──                         │
│                                                                 │
│  ── New: LinkedIn Style Cloning ──                             │
│  [+ Add profile URL]                                           │
│                                                                 │
│  John Doe       [Resync] [Remove]   24 posts  · 2d ago         │
│  Jane Smith     [Resync] [Remove]   18 posts  · 3d ago         │
│  ...                                                            │
│                                                                 │
│  [🎨 Generate Style Fingerprint from 287 posts]                │
│                                                                 │
│  ── Generated Fingerprint (editable) ──                         │
│  Saved as StyleProfile "Cloned Voice"                           │
│  Activate it in compose to use this style                       │
└────────────────────────────────────────────────────────────────┘

Compose flow (existing — gets one tweak):
  When using "Cloned Voice" style → also inject 3 random posts as
  few-shot examples in the prompt for tone matching.
```

### Data flow

```
1. User adds profile URL
   → POST to /styles/profiles/add
   → Apify scrape (10–30s)
   → Store in linkedin_profiles.posts_json (JSON array)
   → Show in UI

2. User clicks "Generate Fingerprint"
   → Sample 30 random posts across all profiles
   → Send to Claude with analysis prompt
   → Claude returns structured style guide (markdown)
   → Save as StyleProfile name="Cloned Voice"
   → User can edit it manually if they want

3. User composes a post with "Cloned Voice" selected
   → Existing compose flow runs
   → If style is the cloned one: ALSO pull 3 random sample posts
   → Inject as few-shot examples in the prompt
   → Generate
```

### Storage (mostly already exists)

`linkedin_profiles` table already has the right fields. We just need to add 2 columns:

```prisma
model LinkedInProfile {
  id              String    @id @default(uuid())
  profileUrl      String    @unique @map("profile_url")
  displayName     String?   @map("display_name")
  postsJson       String?   @map("posts_json") @db.Text
  embedding       String?   @map("embedding") @db.Text
  lastSyncedAt    DateTime? @map("last_synced_at")     // NEW
  postCount       Int?      @map("post_count")          // NEW
  createdAt       DateTime  @default(now()) @map("created_at")
}
```

`posts_json` shape:
```json
[
  {
    "text": "Post content here...",
    "postedAt": "2026-04-15T10:00:00Z",
    "engagement": { "likes": 234, "comments": 12 },
    "url": "https://linkedin.com/posts/..."
  }
]
```

---

## PR-Sized Chunks

The work splits into **5 small PRs**. Each is independently shippable.

### PR 1: Apify integration + DB schema

**Goal:** Backend plumbing — fetch posts from a LinkedIn URL via Apify and store them.

**Files:**
- `lib/apify.ts` (new) — thin client around Apify Actor API
- `prisma/schema.prisma` — add `lastSyncedAt`, `postCount` to `LinkedInProfile`
- `app/(app)/styles/profile-actions.ts` (new) — server actions: `addLinkedInProfile(url)`, `resyncProfile(id)`, `removeProfile(id)`
- `.env.example` — document `APIFY_API_TOKEN`

**Acceptance:**
- [ ] Calling `addLinkedInProfile("https://linkedin.com/in/...")` from a script scrapes posts and stores them
- [ ] `posts_json` contains array of `{ text, postedAt, engagement, url }`
- [ ] `displayName` and `postCount` populated
- [ ] Resync replaces the posts with fresh data
- [ ] Build passes

**Effort:** 2–3 hrs
**Risk:** Apify actor selection — may need to try 2–3 to find a reliable one

---

### PR 2: Profile management UI

**Goal:** Let user add/remove/resync profiles from the `/styles` page.

**Files:**
- `app/(app)/styles/page.tsx` — add "LinkedIn Profiles" section below existing styles
- `app/(app)/styles/linkedin-profile-list.tsx` (new) — client component with Add/Resync/Remove
- `components/ui/...` — reuse existing shadcn components

**Acceptance:**
- [ ] User can paste a LinkedIn profile URL and click "Add"
- [ ] Loading state shows during Apify scrape
- [ ] Success: profile shows in list with name, post count, last sync date
- [ ] "Resync" button refreshes that profile's posts
- [ ] "Remove" button deletes the profile
- [ ] Error handling: bad URL, scraping failure, duplicate
- [ ] Build passes

**Effort:** 2 hrs
**Risk:** None — pure CRUD UI

---

### PR 3: Style fingerprint generation

**Goal:** Distill scraped posts into a written style guide using Claude.

**Files:**
- `lib/claude.ts` — already exists; add `analyzeWritingStyle(posts: string[])` function
- `app/(app)/styles/profile-actions.ts` — add `generateStyleFingerprint()` action
- `lib/prompts.ts` — add `buildStyleAnalysisPrompt()` 
- `app/(app)/styles/linkedin-profile-list.tsx` — add "Generate Fingerprint" button

**The analysis prompt:**
```
You are analyzing a corpus of LinkedIn posts to extract a writing style guide.

Below are 30 sample posts. Identify the patterns:

1. Average post length (words / paragraphs)
2. Sentence structure (short punchy / flowing / mixed)
3. Common opening hooks
4. Whitespace and formatting conventions
5. Tone (confident / vulnerable / contrarian / educational / ...)
6. Vocabulary register (formal / casual / technical / mixed)
7. How they use data, numbers, specifics
8. How they tell stories or share personal anecdotes
9. Closing patterns (call-to-action / declarative summary / question)
10. What they DON'T do (clichés they avoid)

Output a writing style guide a junior writer could follow to imitate this voice.
Be specific. Use examples from the posts.
Output as markdown.

POSTS:
[posts here]
```

**Acceptance:**
- [ ] "Generate Fingerprint" button runs the analysis
- [ ] Sample 30 random posts (or all if fewer) across all profiles
- [ ] Claude returns markdown style guide
- [ ] Save as a `StyleProfile` named "Cloned Voice"
- [ ] If "Cloned Voice" already exists, update it instead of duplicating
- [ ] User can edit the generated style guide manually (existing edit flow on /styles)
- [ ] Show preview of fingerprint in the UI
- [ ] Build passes

**Effort:** 2 hrs
**Risk:** Prompt tuning — may need 2–3 iterations to get useful style guides

---

### PR 4: Few-shot generation (the magic step)

**Goal:** When generating with the "Cloned Voice" style, inject 3 random sample posts as examples.

**Files:**
- `app/(app)/compose/actions.ts` — modify `composePost()` to detect cloned voice and pull samples
- `app/(app)/posts/actions.ts` — same for `regeneratePost()`
- `lib/prompts.ts` — modify `buildSystemPrompt()` to accept optional `examples: string[]`
- `prisma/schema.prisma` — add `isClonedVoice` boolean to `StyleProfile` so we know which one to enrich (or detect by name)

**The new system prompt section:**
```
[existing prompt]

EXAMPLES OF THE TARGET VOICE (study these — your output should feel
like it was written by the same person):

Example 1:
[sample post 1]

Example 2:
[sample post 2]

Example 3:
[sample post 3]
```

**Acceptance:**
- [ ] When generating with the cloned voice style, 3 random samples are fetched
- [ ] Samples are pulled across all profiles (not just one)
- [ ] Samples are injected into the prompt
- [ ] Generated posts noticeably match the voice (subjective — manual QA)
- [ ] Other styles (manual ones) work as before — unchanged
- [ ] Build passes

**Effort:** 1.5 hrs
**Risk:** Prompt may exceed token budget if examples are long — truncate to ~500 chars each

---

### PR 5: ADR + polish

**Goal:** Document the architecture and clean up rough edges.

**Files:**
- `docs/adr/006-linkedin-profile-style-cloning.md` (new)
- Various — fix any UX issues found during QA

**Acceptance:**
- [ ] ADR documents: Apify choice, single-style approach, fingerprint + few-shot, manual resync
- [ ] Trade-offs and alternatives section
- [ ] Known issues (LinkedIn ToS, scraping reliability, fingerprint quality)
- [ ] Future work section (per-profile styles, auto-resync, multiple fingerprints)

**Effort:** 30 min
**Risk:** None

---

## Total Effort

| PR | Hours |
|----|-------|
| PR 1: Apify + schema | 2–3 |
| PR 2: Profile UI | 2 |
| PR 3: Fingerprint generation | 2 |
| PR 4: Few-shot generation | 1.5 |
| PR 5: ADR + polish | 0.5 |
| **Total** | **~8 hours** |

---

## Open Questions / Risks

### Apify actor selection
- Need to test which LinkedIn scraper actor is most reliable
- Candidates: `apimaestro/linkedin-profile-posts`, `bebity/linkedin-premium-actor`
- Some may need a LinkedIn cookie; others handle auth themselves
- Plan: try one in PR 1; if unreliable, swap actor name (15-min change)

### LinkedIn ToS / Account safety
- Scraping LinkedIn violates their ToS
- Apify actors typically use rotating proxies → low risk to your account
- Worst case: Apify's account gets banned, not yours
- Document in ADR

### Fingerprint quality
- Claude's analysis depends heavily on the prompt
- May need iteration — the first version of the style guide may be too generic
- Mitigation: user can edit the generated guide manually

### Token budget for few-shot
- LinkedIn posts can be 2000+ chars each
- 3 examples × 2000 chars = 6000 chars added to prompt
- Add to existing ~3000 char system prompt = ~9000 chars
- Well within Claude Sonnet 4's 200K context, no issue
- For Gemini Flash, also fine (1M context)

### Cost projection
| Phase | Cost |
|-------|------|
| Initial scrape (15 profiles) | ~$0.15 |
| Resyncs (manual, ~1/week per profile) | ~$0.60/month |
| Fingerprint generation (Claude) | ~$0.02 each, run rarely |
| Per-post generation (with 3 examples) | ~$0.01 each (vs ~$0.005 without) |
| **Total monthly (10 posts/day) | **~$3–5/month** |

---

## What's Out of Scope

These would be future ADRs / tickets:

- **Multiple fingerprints** (e.g., "VC voice" vs "Engineer voice") — possible later by grouping profiles
- **Per-profile styles** — chose combined for simplicity; can split later
- **Auto-resync via cron** — manual is enough; can add later
- **Follower count / engagement weighting** — could weight examples by engagement; deferred
- **LinkedIn comment style cloning** — only posts for now
- **Email/newsletter author cloning** — different scraping path

---

## Recommended Order

Start with **PR 1 + 2 together** (~4 hrs) — get scraping + UI working. You can manually QA with 2-3 profiles before paying for more.

Then **PR 3** (~2 hrs) — see if the fingerprint is any good. If yes, continue.

Then **PR 4** (~1.5 hrs) — the actual voice-matching magic.

Then **PR 5** (~0.5 hr) — document.

**Pause point:** After PR 3, before paying for many scrapes, do a real QA pass. If the style guide quality is poor, we tune the prompt before scaling up profiles.

---

## Pre-flight Checklist

Before we start PR 1, you'll need:

1. **Apify account** at [apify.com](https://apify.com) — free signup
2. **API token** from Apify Settings → Integrations → API
3. **$5 of credit** added (covers initial scraping + plenty of buffer)
4. **Add `APIFY_API_TOKEN` to `.env`**
5. **Pick 2–3 test profile URLs** — accounts whose voice you actually want to clone

Ready to start? Reply "PR 1" and I'll begin.
