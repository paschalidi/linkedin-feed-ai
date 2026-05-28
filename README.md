# LinkedIn Feed AI

AI-powered LinkedIn content generator.

## Setup

1. Clone the repo
2. Copy `.env.local.example` to `.env.local` and fill in your keys
3. Run `npm install`
4. Run `npm run dev`

### Supabase Configuration

This project uses Supabase's **new API key system** (publishable + secret keys).

**1. Get your Publishable key (client-side):**
- Go to [Supabase Dashboard → Project Settings → API](https://supabase.com/dashboard/project/_/settings/api)
- Copy the **"Publishable key"** (starts with `sb_publishable_`)
- Add to `.env.local`: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`

**2. Get your Secret key (server-side admin operations):**
- In the same API settings page
- Under **"Secret API key"**, click **"Generate new secret key"**
- Copy the key (starts with `sb_secret_`)
- Add to `.env.local`: `SUPABASE_SECRET_KEY=sb_secret_...`

**Note:** Do NOT commit `.env.local` to git. It contains secrets.

### Dev Login (Local Development)

To bypass email verification in local dev:

1. Add your `SUPABASE_SECRET_KEY` to `.env.local`
2. Start the app: `npm run dev`
3. On the login page, click **"Developer Login (skip email)"**
4. Click **"Dev Login"** — instantly creates/logs in a test user

## Tech Stack

- Next.js 15 + TypeScript + Tailwind CSS
- shadcn/ui components
- Supabase (Postgres + pgvector + Auth)
- OpenAI / Anthropic (BYO API key)
