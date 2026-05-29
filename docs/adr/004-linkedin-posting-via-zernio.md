# ADR 004: LinkedIn Direct Posting via Zernio

## Status

Accepted

## Context

The core user flow of the app is: ingest articles → generate LinkedIn post draft → review and edit → post to LinkedIn. The last step was entirely manual: users had to copy the draft, open LinkedIn, paste it, and publish.

We explored three approaches for programmatic posting:

1. **Direct LinkedIn Posts API** — requires building OAuth 2.0 flow, handling 60-day token expiry (no refresh tokens for self-serve apps), and maintaining API versioning
2. **Third-party social API service (Zernio)** — handles OAuth, token refresh, retries, rate limits for us; we just POST content with an API key
3. **Webhook to Zapier/Make** — zero LinkedIn API work but requires user to set up external automation

## Decision

We chose **Option B: Zernio** for the following reasons:

- **Speed to ship:** 30 minutes of implementation vs. 1+ day for direct OAuth
- **No token expiry headache:** Zernio manages OAuth refresh under the hood
- **Rate limit resilience:** Zernio queues and retries automatically
- **Cost:** Free tier covers 2 accounts with unlimited posts — more than enough for a personal tool
- **Future-proof:** If we later want direct API control, swapping the `lib/zernio.ts` implementation is a 50-line change

### Architecture

```
User clicks "Post to LinkedIn" on /posts/[id]
    → PublishToLinkedInButton (client component)
    → publishToLinkedIn(id) server action
    → lib/zernio.ts: createLinkedInPost(content, accountId)
    → POST https://zernio.com/api/v1/posts
    → On success: update DB (status="posted", linkedInPostId, publishedToLinkedInAt)
```

### Schema Changes

Added two fields to `generated_posts`:

| Field | Type | Purpose |
|-------|------|---------|
| `linkedInPostId` | `String?` | Zernio post ID for traceability |
| `publishedToLinkedInAt` | `DateTime?` | When the post was published |

These allow us to:
- Prevent duplicate publishing (button hidden if already published)
- Show "Published to LinkedIn" timestamp in the details panel
- Link directly to the live post if Zernio returns a `postUrl`

### Configuration

Two environment variables required in `.env.local`:

```bash
ZERNIO_API_KEY=your_zernio_api_key
ZERNIO_LINKEDIN_ACCOUNT_ID=your_connected_linkedin_account_id
```

The `ZERNIO_LINKEDIN_ACCOUNT_ID` is obtained by connecting a LinkedIn profile in the Zernio dashboard. This is stored as an env var for MVP; future iterations may move it to a Settings page DB table.

### API Client

`lib/zernio.ts` is a thin wrapper (~80 lines) around Zernio's REST API:

- **Endpoint:** `POST /api/v1/posts`
- **Payload:** `{ content, platforms: [{ platform: "linkedin", accountId }], publishNow: true }`
- **Error handling:** Catches HTTP errors, parses JSON error messages, surfaces human-readable errors to the UI
- **No retry logic:** Zernio handles retries server-side; we surface failures immediately

### UI Changes

On the post review page (`/posts/[id]`):

- **New button:** "Post to LinkedIn" (blue outline, next to "Mark as Posted")
- **Loading state:** "Publishing..." with disabled button
- **Success state:** Button changes to "Published!", shows "View on LinkedIn" link if URL returned
- **Error state:** Red error text below the button with the API error message
- **Details panel:** Shows "Published to LinkedIn" with date/time and post ID
- **Duplicate prevention:** Button is hidden if `publishedToLinkedInAt` is already set

## Consequences

### Positive

- **One-click publishing:** The full pipeline from article ingestion to LinkedIn post is now automated end-to-end
- **No OAuth code to maintain:** Zernio handles the complex three-legged OAuth flow with LinkedIn
- **Resilient to API changes:** If LinkedIn changes their API schema, Zernio updates their adapter; our code stays the same
- **Audit trail:** `linkedInPostId` and `publishedToLinkedInAt` give us full traceability

### Negative / Trade-offs

- **Vendor dependency:** If Zernio shuts down or changes pricing, we need to swap to direct API or another service
- **No refresh token control:** We can't force a re-auth or debug token issues — it's opaque behind Zernio
- **Env var configuration:** Not user-friendly; requires editing `.env.local` and redeploying. Will move to Settings page DB storage in a future iteration
- **Post content restrictions:** LinkedIn's 3,000 char limit and duplicate-content rejection (422) are still enforced by LinkedIn's API, not Zernio. Our prompt already targets ~2 paragraphs which is well under the limit

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Direct LinkedIn Posts API (Option A) | Requires ~1 day of OAuth implementation, 60-day token expiry with no automatic refresh for self-serve apps, and ongoing API version maintenance. Deferred as a future swap if Zernio becomes problematic. |
| Webhook to Zapier (Option C) | Requires every user to set up their own Zapier automation. For a personal tool, this adds friction without benefit. |
| Store tokens in DB instead of env vars | Better UX, but requires a Settings page (Ticket #13). Env vars are the pragmatic MVP step. |

## Related Files

- `lib/zernio.ts` — Zernio API client
- `app/(app)/posts/actions.ts` — `publishToLinkedIn()` server action
- `app/(app)/posts/[id]/publish-to-linkedin-button.tsx` — Client component with loading/error/success states
- `app/(app)/posts/[id]/page.tsx` — Post review page with LinkedIn button and published status
- `prisma/schema.prisma` — `linkedInPostId` and `publishedToLinkedInAt` fields

## Future Work

- Move `ZERNIO_LINKEDIN_ACCOUNT_ID` from env var to a Settings page so users can configure without redeploying
- Add scheduled publishing (Ticket #14) — queue a post to be published at a specific time via Zernio's `scheduledFor` field
- Swap to direct LinkedIn API if Zernio pricing or reliability becomes an issue

## Date

2026-05-29
