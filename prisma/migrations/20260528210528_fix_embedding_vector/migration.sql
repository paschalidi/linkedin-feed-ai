-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing match_articles function if it exists (from old setup.sql attempt)
DROP FUNCTION IF EXISTS match_articles(VECTOR, FLOAT, INT);
DROP FUNCTION IF EXISTS match_articles(real[], FLOAT, INT);

-- Clear old incompatible embeddings (wrong dimensions from previous model)
UPDATE articles SET embedding = NULL;

-- Alter column type from TEXT to proper vector
ALTER TABLE articles ALTER COLUMN embedding TYPE vector(768) USING NULL;

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_articles_embedding ON articles USING ivfflat (embedding vector_cosine_ops);

-- Function for semantic search over articles
-- Accepts query embedding as real[] (PostgreSQL array) since Supabase RPC passes JSON arrays
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
    1 - (articles.embedding <=> query_embedding::vector(768)) AS similarity
  FROM articles
  WHERE 1 - (articles.embedding <=> query_embedding::vector(768)) > match_threshold
  ORDER BY articles.embedding <=> query_embedding::vector(768)
  LIMIT match_count;
$$;
