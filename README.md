# LinkedIn Feed AI

AI-powered LinkedIn content generator.

## Quick Start

1. **Clone and install:**
   ```bash
   git clone https://github.com/paschalidi/linkedin-feed-ai.git
   cd linkedin-feed-ai
   npm install
   ```

2. **Configure environment:**
   Copy `.env` to `.env.local` and fill in your keys.

3. **Setup database:**
   ```bash
   npm run db:setup
   ```

4. **Start development:**
   ```bash
   npm run dev
   ```

## Database Setup

This project uses **Supabase** (Postgres + pgvector). Tables are managed via Git-tracked migrations.

### One-time: Get your Database URL

1. Go to [Supabase Dashboard → Settings → Database](https://supabase.com/dashboard/project/_/settings/database)
2. Under **"Connection string"**, select **"URI"**
3. Copy the connection string (looks like: `postgresql://postgres:...`)
4. Add to `.env.local`:
   ```
   SUPABASE_DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db....supabase.co:5432/postgres
   ```

### Run Migrations

```bash
# Create all tables, indexes, and functions
npm run db:setup

# Wipe everything and start fresh
npm run db:reset && npm run db:setup
```

Migrations live in `supabase/setup.sql` and are executed by `scripts/setup-db.ts`.

## Auth Keys

This project uses Supabase's **new API key system** (publishable + secret keys).

**Publishable key** (client-side, already in `.env`):
- Found at: Supabase Dashboard → Project Settings → API

**Secret key** (server-side admin, for Dev Login):
- Generate at: Supabase Dashboard → Project Settings → API → Secret API key
- Add to `.env.local`: `SUPABASE_SECRET_KEY=sb_secret_...`

## Testing

```bash
# Unit tests (RSS parser, article extraction)
npm test

# E2E tests (page loads, navigation)
npx playwright test

# Watch mode
npm run test:watch
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm test` | Run unit tests |
| `npm run db:setup` | Create/update database tables |
| `npm run db:reset` | Drop all tables |
| `npm run test:watch` | Run tests in watch mode |

## Tech Stack

- Next.js 16 + TypeScript + Tailwind CSS
- shadcn/ui components
- Supabase (Postgres + pgvector + Auth)
- OpenAI / Anthropic (BYO API key)
- Vitest + Playwright for testing

## Project Structure

```
app/
  (app)/              # Protected routes with sidebar
    dashboard/
    sources/
    ideas/
    styles/
    posts/
    compose/
    settings/
  login/              # Auth pages (no sidebar)
  layout.tsx          # Root layout
lib/
  supabase/           # Client/server/middleware
  rss-parser.ts       # RSS/Atom feed parsing
  article-extractor.ts
  openai.ts
scripts/
  setup-db.ts         # Database migration runner
  reset-db.ts         # Database reset
tests/                # Unit tests
supabase/
  setup.sql           # All DDL statements
```
