# ADR 008: Automation Pipeline (Cron Jobs)

## Status

Accepted

## Context

The app was entirely manual: user adds RSS sources, clicks ingest, adds ideas, clicks generate, approves posts, clicks publish. For a single-user app that runs daily, this is too much friction.

We needed hands-off automation for three workflows:
1. **RSS sync** — fetch new articles from all feeds automatically
2. **Idea generation** — generate a new topic idea daily from recent articles
3. **Publishing queue** — publish approved posts to LinkedIn on a schedule

## Decision

### 1. Three Cron Jobs in `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/sync-rss", "schedule": "0 6 */2 * *" },
    { "path": "/api/cron/generate-ideas", "schedule": "0 * * * *" },
    { "path": "/api/cron/publish-queue", "schedule": "0 * * * *" }
  ]
}
```

- **RSS Sync** — Every 2 days at 06:00 UTC. Fixed schedule, no timezone gating needed.
- **Idea Generation** — Every hour. Gated by "hasn't run today in user's timezone" and `autoGenerateIdeas` toggle.
- **Publish Queue** — Every hour. Gated by "is it the user's preferred posting time?" and `autoPublishApproved` toggle.

### 2. Why Hourly Crons with Gating?

Vercel Cron schedules are static UTC. The user's preferred posting time is in their local timezone (e.g., 09:00 Europe/Athens). If we used a fixed UTC cron, DST would drift the effective local time by ±1 hour.

**Solution:** Run hourly (`0 * * * *`) and gate inside the route:
- "Is it now at or after the user's preferred time in their timezone?"
- "Has this job already run today?"

If both are true → execute. If not → return 200 early with `skipped` status.

This handles DST automatically without external infrastructure.

### 3. Settings-Driven Automation (`UserSettings` model)

A new singleton `UserSettings` table stores:

| Field | Default | Purpose |
|-------|---------|---------|
| `autoSyncRss` | `true` | Enable RSS auto-sync cron |
| `autoGenerateIdeas` | `false` | Enable daily idea generation |
| `autoPublishApproved` | `false` | Auto-queue approved posts |
| `timezone` | `"UTC"` | User's IANA timezone |
| `preferredPostingTime` | `"09:00"` | Time of day to publish (HH:MM) |
| `maxPostsPerDay` | `1` | Global cap on LinkedIn publishes |

All cron routes read settings first and abort early if toggles are off.

### 4. Publishing Queue (`PublishQueue` model)

New table with `postId` (unique), `scheduledAt`, `status` (`pending` | `published` | `failed`), `publishedAt`, `error`.

**Flow:**
1. User approves a post
2. If `autoPublishApproved` is ON → automatically call `addToQueue(postId, nextPreferredTime)`
3. If OFF → user can manually click "Add to Queue" on the post detail page
4. Hourly cron picks the oldest `pending` item whose `scheduledAt <= now()`
5. Publishes to LinkedIn via `publishPostToLinkedInCore()`
6. Marks queue item as `published` or `failed` (no auto-retry)

**Daily cap:** Before publishing, the cron counts `publishedToLinkedInAt >= startOfDay(timezone)`. If count >= `maxPostsPerDay`, it skips with `"Daily publish limit reached"`.

### 5. Daily Idea Generation

Refactored `surpriseMe()` and the cron to share a single `generateDailyIdeas(params)` function:

| Caller | `articleCount` | `styleAware` | `recencyFilter` |
|--------|---------------|--------------|-----------------|
| Surprise Me button | 30 | `false` | `null` (all articles) |
| Daily cron | 5 | `true` | 30 days |

**Dedup:** If an idea with the same title (case-insensitive, trimmed) was created in the last 24h, the cron skips with `"Duplicate idea generated recently"`.

**Style awareness:** The daily cron reads the active `StyleProfile` and injects the style prompt into the Gemini call so generated ideas match the user's voice.

### 6. Shared Core Publish Logic

Extracted `lib/automation/publish-core.ts` containing `publishPostToLinkedInCore(postId, content)`:
- Reads the saved branded image from `brandedImageData` (or generates fallback)
- Uploads image to Zernio
- Publishes to LinkedIn
- Marks post as `posted`

This is shared by:
- Manual "Post to LinkedIn" button on post detail
- Queue processor cron

### 7. Test Automation Page

`/test-automation` provides manual triggers for all three cron jobs:
- **Run RSS Sync** — calls `syncAllRSSFeeds()` directly
- **Run Idea Generation** — calls `generateDailyIdeas()` + creates `DailyIdea` record
- **Run Publish Queue** — calls `processPublishQueue()` directly

This allows smoke-testing all automation before relying on the cron schedule.

### 8. Automation Logging (`AutomationLog` model)

Every cron run writes a log entry:
- `jobType`: `rss-sync` | `generate-ideas` | `publish-queue`
- `status`: `success` | `failed` | `skipped`
- `details`: human-readable summary

The dashboard widget displays recent logs so the user knows what the machine is doing.

## Consequences

### Positive

- **Truly hands-off**: Once set up, the app generates ideas and publishes posts without user intervention.
- **Safe defaults**: All toggles default to OFF except `autoSyncRss`. User must explicitly enable automation.
- **Timezone-aware**: Hourly crons with timezone gating handle DST automatically.
- **Shared logic**: `generateDailyIdeas()`, `publishPostToLinkedInCore()`, and `addToQueue()` are used by both UI and cron, preventing drift.
- **Testable**: `/test-automation` page lets the user verify everything works before waiting for cron schedules.
- **Observable**: Dashboard widget + `AutomationLog` table give visibility into what ran and when.
- **Resilient**: Failed publishes mark the queue item as `failed` with error text. No infinite retry loops.

### Negative / Trade-offs

- **Hourly cron cost**: On Vercel Hobby, 2 hourly crons × 730 hours/month = ~1,460 invocations. Within free limits but worth monitoring.
- **No queue priority**: FIFO only. No way to star/prioritize a post.
- **Single-user assumption**: `UserSettings` is a singleton (one row). Multi-user would require a `userId` column and per-user queues.
- **Magic link rate limits**: Supabase free tier limits auth emails. Mitigated by switching to dev-login (password-protected) for single-user access.
- **No retry for failed publishes**: If Zernio is down, the queue item stays `failed` until the user manually fixes it. No exponential backoff.

## Related Files

- `lib/automation/generate-ideas.ts` — Shared idea generation core
- `lib/automation/publish-core.ts` — Shared LinkedIn publish core
- `lib/automation/publish-queue.ts` — Queue processor logic
- `lib/automation/schedule.ts` — `getNextPreferredPostingTime()` helper
- `lib/automation/log.ts` — `logAutomationJob()` helper
- `lib/automation/status.ts` — Dashboard status computation
- `app/api/cron/sync-rss/route.ts` — RSS sync cron
- `app/api/cron/generate-ideas/route.ts` — Idea generation cron
- `app/api/cron/publish-queue/route.ts` — Queue processor cron
- `app/(app)/settings/page.tsx` — Automation toggles UI
- `app/(app)/posts/queue-actions.ts` — `addToQueue()`, `removeFromQueue()`, `getQueue()`
- `app/(app)/test-automation/page.tsx` — Manual trigger UI

## Deployment Notes

1. Add `CRON_SECRET` to environment variables (any random string).
2. Add `DEV_PASSWORD` to environment variables (strong password for single-user login).
3. Set Supabase Dashboard → Auth → URL Configuration:
   - **Site URL:** `https://your-app.vercel.app/`
   - **Redirect URLs:** `https://your-app.vercel.app/auth/callback`
4. Visit `/settings` to enable automation toggles and set timezone + preferred posting time.
5. Visit `/test-automation` to manually trigger each job and verify it works.

## Date

2026-05-31
