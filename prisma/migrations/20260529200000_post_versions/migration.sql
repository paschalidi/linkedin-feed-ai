-- Add version tracking columns to generated_posts
ALTER TABLE generated_posts
  ADD COLUMN IF NOT EXISTS versions TEXT DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS current_version_index INT DEFAULT 0;

-- Migrate existing posts: initialize versions with their current content
UPDATE generated_posts
SET
  versions = jsonb_build_array(
    jsonb_build_object('content', COALESCE(final_content, draft_content), 'createdAt', created_at::text)
  )::text,
  current_version_index = 0
WHERE versions = '[]' OR versions IS NULL;
