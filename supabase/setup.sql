-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Go to: https://supabase.com/dashboard/project/_/sql/new
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Newsletter sources (RSS feeds or manual URLs)
CREATE TABLE newsletter_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rss', 'manual')),
  url TEXT,
  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ingested articles with vector embeddings
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES newsletter_sources(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Style profiles (how to write)
CREATE TABLE style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- LinkedIn profiles scraped for style reference
CREATE TABLE linkedin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_url TEXT NOT NULL UNIQUE,
  display_name TEXT,
  posts_json JSONB,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Daily ideas / topics queue
CREATE TABLE daily_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  source_article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'used', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Generated LinkedIn posts
CREATE TABLE generated_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID REFERENCES daily_ideas(id) ON DELETE SET NULL,
  draft_content TEXT NOT NULL,
  final_content TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'posted')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_articles_source ON articles(source_id);
CREATE INDEX idx_articles_embedding ON articles USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_daily_ideas_user ON daily_ideas(user_id);
CREATE INDEX idx_daily_ideas_status ON daily_ideas(status);
CREATE INDEX idx_generated_posts_idea ON generated_posts(idea_id);
CREATE INDEX idx_generated_posts_status ON generated_posts(status);

-- Row Level Security (single-user for now, extensible later)
ALTER TABLE newsletter_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_posts ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (single-user mode)
CREATE POLICY "Allow all for authenticated users" ON newsletter_sources FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON articles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON style_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON linkedin_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON daily_ideas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON generated_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Function for semantic search over articles
CREATE OR REPLACE FUNCTION match_articles(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id UUID,
  source_id UUID,
  title TEXT,
  url TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    articles.id,
    articles.source_id,
    articles.title,
    articles.url,
    articles.content,
    1 - (articles.embedding <=> query_embedding) AS similarity
  FROM articles
  WHERE 1 - (articles.embedding <=> query_embedding) > match_threshold
  ORDER BY articles.embedding <=> query_embedding
  LIMIT match_count;
$$;
