-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Go to: https://supabase.com/dashboard/project/_/sql/new
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Newsletter sources (RSS feeds or manual URLs)
CREATE TABLE IF NOT EXISTS newsletter_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rss', 'manual')),
  url TEXT,
  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ingested articles with metadata (embeddings live on article_chunks)
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES newsletter_sources(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  excerpt TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  content_hash TEXT UNIQUE,
  canonical_url TEXT,
  site_name TEXT,
  char_count INT,
  extraction_method TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Article chunks with per-chunk embeddings for semantic search
CREATE TABLE IF NOT EXISTS article_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  text TEXT NOT NULL,
  char_start INT NOT NULL,
  char_end INT NOT NULL,
  embedding VECTOR(768),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(article_id, chunk_index)
);

-- Style profiles (how to write)
CREATE TABLE IF NOT EXISTS style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- LinkedIn profiles scraped for style reference
CREATE TABLE IF NOT EXISTS linkedin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_url TEXT NOT NULL UNIQUE,
  display_name TEXT,
  posts_json JSONB,
  embedding VECTOR(768),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Daily ideas / topics queue
CREATE TABLE IF NOT EXISTS daily_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  source_article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'used', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Generated LinkedIn posts
CREATE TABLE IF NOT EXISTS generated_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID REFERENCES daily_ideas(id) ON DELETE SET NULL,
  draft_content TEXT NOT NULL,
  final_content TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'posted')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_content_hash ON articles(content_hash);
CREATE INDEX IF NOT EXISTS idx_article_chunks_article_id ON article_chunks(article_id);
CREATE INDEX IF NOT EXISTS idx_article_chunks_embedding ON article_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_daily_ideas_user ON daily_ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_ideas_status ON daily_ideas(status);
CREATE INDEX IF NOT EXISTS idx_generated_posts_idea ON generated_posts(idea_id);
CREATE INDEX IF NOT EXISTS idx_generated_posts_status ON generated_posts(status);

-- Row Level Security (single-user for now, extensible later)
ALTER TABLE newsletter_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_posts ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (single-user mode)
CREATE POLICY IF NOT EXISTS "Allow all for authenticated users" ON newsletter_sources FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all for authenticated users" ON articles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all for authenticated users" ON article_chunks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all for authenticated users" ON style_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all for authenticated users" ON linkedin_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all for authenticated users" ON daily_ideas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all for authenticated users" ON generated_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Function for semantic search over article_chunks (returns best chunk per article)
CREATE OR REPLACE FUNCTION match_articles(
  query_embedding real[],
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id TEXT,
  source_id TEXT,
  title TEXT,
  url TEXT,
  content TEXT,
  best_chunk TEXT,
  best_chunk_index INT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  WITH ranked_chunks AS (
    SELECT
      c.article_id,
      c.text AS chunk_text,
      c.chunk_index,
      1 - (c.embedding <=> query_embedding::vector(768)) AS chunk_similarity,
      ROW_NUMBER() OVER (
        PARTITION BY c.article_id
        ORDER BY c.embedding <=> query_embedding::vector(768)
      ) AS rn
    FROM article_chunks c
    WHERE 1 - (c.embedding <=> query_embedding::vector(768)) > match_threshold
  )
  SELECT
    a.id,
    a.source_id,
    a.title,
    a.url,
    a.content,
    rc.chunk_text AS best_chunk,
    rc.chunk_index AS best_chunk_index,
    rc.chunk_similarity AS similarity
  FROM ranked_chunks rc
  JOIN articles a ON a.id = rc.article_id
  WHERE rc.rn = 1
  ORDER BY rc.chunk_similarity DESC
  LIMIT match_count;
$$;
