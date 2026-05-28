# LinkedIn Feed AI

AI-powered LinkedIn content generator.

## Setup

1. Clone the repo
2. Copy `.env.local` to `.env.local` and fill in your keys:
   - Supabase URL + Anon Key
   - OpenAI API Key
   - LinkedIn scraper API key (Apify / Bright Data / RapidAPI)
3. Run `npm install`
4. Run `npm run dev`

## Tech Stack

- Next.js 15 + TypeScript + Tailwind CSS
- shadcn/ui components
- Supabase (Postgres + pgvector + Auth)
- OpenAI / Anthropic (BYO API key)
