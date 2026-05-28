"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchArticleText } from "@/lib/article-extractor";
import { generateEmbedding } from "@/lib/gemini";

export async function ingestArticle(sourceId: string, url: string) {
  const supabase = await createClient();

  // Fetch and extract article text
  const { title, content } = await fetchArticleText(url);

  // Generate embedding
  const embedding = await generateEmbedding(content);

  // Store in database
  const { data, error } = await supabase
    .from("articles")
    .insert({
      source_id: sourceId,
      title,
      url,
      content,
      embedding: JSON.stringify(embedding),
    })
    .select()
    .single();

  if (error) throw error;

  // Update source last_fetched_at
  await supabase
    .from("newsletter_sources")
    .update({ last_fetched_at: new Date().toISOString() })
    .eq("id", sourceId);

  return data;
}

export async function getArticlesBySource(sourceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("source_id", sourceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getAllArticles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}
