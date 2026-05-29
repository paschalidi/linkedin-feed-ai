-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. Add metadata columns to articles
-- ============================================================================
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS excerpt TEXT,
  ADD COLUMN IF NOT EXISTS author TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS canonical_url TEXT,
  ADD COLUMN IF NOT EXISTS site_name TEXT,
  ADD COLUMN IF NOT EXISTS char_count INT,
  ADD COLUMN IF NOT EXISTS extraction_method TEXT;

-- Unique index on content hash for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS articles_content_hash_idx ON articles(content_hash);

-- Ensure url is unique (if not already)
CREATE UNIQUE INDEX IF NOT EXISTS articles_url_idx ON articles(url);

-- ============================================================================
-- 2. Create article_chunks table
-- ============================================================================
CREATE TABLE IF NOT EXISTS article_chunks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  text TEXT NOT NULL,
  char_start INT NOT NULL,
  char_end INT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_id, chunk_index)
);

-- Index for chunk lookups by article
CREATE INDEX IF NOT EXISTS article_chunks_article_id_idx ON article_chunks(article_id);

-- Index for vector similarity search on chunks
CREATE INDEX IF NOT EXISTS article_chunks_embedding_idx
  ON article_chunks USING ivfflat (embedding vector_cosine_ops);

-- ============================================================================
-- 3. Drop old match_articles function (operates on articles.embedding)
-- ============================================================================
DROP FUNCTION IF EXISTS match_articles(real[], FLOAT, INT);
DROP FUNCTION IF EXISTS match_articles(VECTOR, FLOAT, INT);

-- ============================================================================
-- 4. New match_articles — operates on article_chunks, returns best chunk per article
-- ============================================================================
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
