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
