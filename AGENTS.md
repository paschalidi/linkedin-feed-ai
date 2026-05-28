<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# LinkedIn Feed AI — Agent Handoff Document

## What This App Does

AI-powered LinkedIn content generator. The user feeds it newsletter articles (via RSS or manual URL), defines writing style profiles, adds topic ideas, and the AI generates LinkedIn post drafts. The user reviews, edits, and copies to clipboard for posting.

**Current Status:** MVP foundation is built. Core pages work. Database is set up via Prisma.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Supabase Postgres + pgvector |
| ORM | Prisma 7 with @prisma/adapter-pg |
| Auth | Supabase Auth (magic link + Dev Login bypass) |
| AI/LLM | OpenAI (BYO API key) |
| Fonts | Plus Jakarta Sans (headings), Geist Sans (body), Geist Mono (code) |
| Testing | Vitest + Playwright |

---

## Project Structure

```
app/
  (app)/                    # Protected routes WITH sidebar layout
    layout.tsx              # Sidebar + main content wrapper
    dashboard/page.tsx      # Stats + recent items
    sources/page.tsx        # Add newsletter sources (URL/RSS)
    ideas/page.tsx          # Queue of topics
    styles/page.tsx         # Writing style profiles
    posts/page.tsx          # Generated posts history
    posts/[id]/page.tsx     # Post editor + review
    compose/page.tsx        # AI composer: pick idea + style → generate
    settings/page.tsx       # Settings (placeholder)
  login/page.tsx            # Auth page (magic link + dev bypass)
  page.tsx                  # Root redirect to /dashboard
  auth/callback/route.ts    # Supabase OAuth callback
  layout.tsx                # Root layout with fonts + Toaster

lib/
  prisma.ts                 # Prisma client singleton with pg adapter
  supabase/                 # Auth clients (client.ts, server.ts, middleware.ts)
  openai.ts                 # Embedding + post generation
  rss-parser.ts             # RSS/Atom feed parsing
  article-extractor.ts      # HTML → readable text (Cheerio)

prisma/
  schema.prisma             # Full data model (6 tables)
  config.ts                 # Prisma config with connection URLs
  migrations/               # Git-tracked migrations

supabase/
  setup.sql                 # Complete DDL (legacy, kept for reference)

components/
  sidebar.tsx               # Navigation sidebar
  copy-button.tsx           # Clipboard copy component
  ui/                       # shadcn/ui components
```

---

## Database Schema (Prisma)

| Model | Purpose |
|-------|---------|
| `NewsletterSource` | RSS feeds / manual URLs to ingest |
| `Article` | Ingested articles with vector embeddings |
| `StyleProfile` | Writing style descriptions |
| `LinkedInProfile` | Scraped profile posts for style reference |
| `DailyIdea` | Topics/ideas queue |
| `GeneratedPost` | AI-generated LinkedIn post drafts |

**Key relations:**
- Article → NewsletterSource (many-to-one)
- DailyIdea → Article (optional source)
- GeneratedPost → DailyIdea (many-to-one)

**Vector search:** `match_articles()` SQL function for semantic similarity (used in compose)

---

## Auth Flow

1. User visits `/` → middleware redirects to `/login`
2. Login page has two modes:
   - **Magic Link:** Enter email → Supabase sends link → click to login
   - **Dev Login:** One-click bypass (creates `dev@linkedin-feed-ai.local` user via admin API)
3. Middleware protects all `(app)/` routes

**Env vars needed for auth:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (only for Dev Login)

---

## Core User Flow

1. **Add Sources** (`/sources`)
   - Paste newsletter URL or RSS feed
   - "Ingest" button fetches article HTML → extracts text → generates OpenAI embedding → stores in DB

2. **Create Style** (`/styles`)
   - Write natural language description of your voice
   - "My Professional Voice: Short paragraphs, confident tone, bullet points..."

3. **Add Ideas** (`/ideas`)
   - Type a topic: "AI in recruiting"
   - "Surprise Me" button auto-picks from articles (not fully implemented)

4. **Compose** (`/compose`)
   - Select idea + style profile
   - Backend does semantic search (vector similarity) to find relevant articles
   - Calls OpenAI GPT-4o with style prompt + article context
   - Generates LinkedIn post draft

5. **Review** (`/posts/[id]`)
   - Edit draft in textarea
   - Approve / Mark as Posted / Copy to Clipboard

---

## Environment Variables

**Required in `.env.local` (gitignored):**

```
# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=https://jubntyastnabvbtylfba.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# Prisma / Database
DATABASE_URL="postgresql://postgres.jubntyastnabvbtylfba:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.jubntyastnabvbtylfba:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"

# Optional
SUPABASE_SECRET_KEY=sb_secret_...
OPENAI_API_KEY=sk-...
```

**How to get connection strings:**
- Go to Supabase Dashboard → Settings → Database
- Use **Session Pooler** tab for `DIRECT_URL` (port 5432, for migrations)
- Use **Transaction Pooler** tab for `DATABASE_URL` (port 6543, for app queries)

---

## Running the App

```bash
# Install dependencies
npm install

# Setup database (creates tables via Prisma migrations)
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate

# Start dev server
npm run dev
```

**Quick commands:**
- `npm run db:migrate` — create new migration
- `npm run db:studio` — open Prisma Studio (GUI)
- `npm test` — unit tests
- `npx playwright test` — E2E tests

---

## What's Working ✅

- [x] Next.js 16 + TypeScript + Tailwind + shadcn/ui
- [x] Supabase Auth (magic link + dev bypass)
- [x] Sidebar navigation with active states
- [x] All CRUD pages (Sources, Ideas, Styles, Posts)
- [x] Prisma ORM with proper migrations
- [x] Database schema (6 tables + vector search)
- [x] Article ingestion pipeline (URL → text → embedding)
- [x] AI Composer (semantic search + GPT-4o generation)
- [x] Post review/editor with copy-to-clipboard
- [x] RSS/Atom parser with tests
- [x] Responsive layout with Plus Jakarta Sans font

---

## What's Not Working / Known Issues ⚠️

1. **Prisma 7 client initialization** — The pg adapter setup in `lib/prisma.ts` may need tweaking for dev server hot reload
2. **"Surprise Me"** — Auto-pick idea from articles is not implemented (button exists but does nothing)
3. **RSS auto-sync** — RSS feeds are added but not automatically polled (only manual URL ingest works)
4. **LinkedIn profile scraping** — No external scraper integrated yet (Ticket 7 in GitHub issues)
5. **Scheduled generation** — No cron/scheduler for daily auto-run
6. **Settings page** — Placeholder, doesn't save API keys to DB yet
7. **Deploy** — Not deployed to Vercel yet

---

## GitHub Issues Created

16 tickets mapped out: https://github.com/paschalidi/linkedin-feed-ai/issues

Key remaining:
- Ticket 6: RSS Feed Ingestion (auto-poll)
- Ticket 7: LinkedIn Profile Scraping
- Ticket 9: "Surprise Me" auto-idea generation
- Ticket 13: Settings page with API key management
- Ticket 14: Scheduled daily generation
- Ticket 16: Deploy to Vercel

---

## Important Notes for Next Agent

1. **Do NOT commit `.env` or `.env.local`** — both are gitignored
2. **This is Next.js 16** — different from Next.js 14/15. Check `node_modules/next/dist/docs/` for APIs.
3. **Prisma 7** uses adapter pattern — see `lib/prisma.ts` for correct initialization
4. **Snake_case DB columns → camelCase Prisma fields** — always use camelCase in code
5. **Supabase Auth** — the `middleware.ts` uses `@supabase/ssr` with `createServerClient`
6. **Vector search** — `match_articles()` is a raw SQL function, call it via `prisma.$queryRaw` or keep using Supabase RPC for that specific query
7. **Build before commit** — always run `npm run build` to catch TypeScript errors

---

## Next Priority Suggestions

1. Fix any remaining Prisma client runtime errors
2. Implement RSS auto-polling (Ticket 6)
3. Build proper Settings page with API key persistence (Ticket 13)
4. Add "Surprise Me" AI auto-idea generation (Ticket 9)
5. Deploy MVP to Vercel (Ticket 16)
