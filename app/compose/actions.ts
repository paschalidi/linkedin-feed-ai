"use server";

import { createClient } from "@/lib/supabase/server";
import { generateEmbedding, generateLinkedInPost } from "@/lib/openai";

export async function getIdeasForCompose() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_ideas")
    .select("*")
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getActiveStyleProfile() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("style_profiles")
    .select("*")
    .eq("is_active", true)
    .single();

  if (error) throw error;
  return data;
}

export async function getAllStyleProfiles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("style_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function retrieveRelevantArticles(ideaText: string) {
  const supabase = await createClient();
  const embedding = await generateEmbedding(ideaText);

  const { data, error } = await supabase.rpc("match_articles", {
    query_embedding: embedding,
    match_threshold: 0.3,
    match_count: 5,
  });

  if (error) throw error;
  return data || [];
}

export async function composePost(formData: FormData) {
  const ideaId = formData.get("idea_id") as string;
  const styleProfileId = formData.get("style_profile_id") as string;

  const supabase = await createClient();

  // Get the idea
  const { data: idea, error: ideaError } = await supabase
    .from("daily_ideas")
    .select("*")
    .eq("id", ideaId)
    .single();

  if (ideaError || !idea) throw new Error("Idea not found");

  // Get the style profile
  const { data: style, error: styleError } = await supabase
    .from("style_profiles")
    .select("*")
    .eq("id", styleProfileId)
    .single();

  if (styleError || !style) throw new Error("Style profile not found");

  // Retrieve relevant articles
  const ideaText = `${idea.title} ${idea.description || ""}`;
  const articles = await retrieveRelevantArticles(ideaText);

  // Generate the post
  const draft = await generateLinkedInPost({
    idea: idea.title,
    ideaDescription: idea.description || undefined,
    stylePrompt: style.prompt_text,
    articles: articles.map((a: any) => ({
      title: a.title,
      content: a.content,
      url: a.url,
    })),
  });

  // Store the generated post
  const { data: post, error: postError } = await supabase
    .from("generated_posts")
    .insert({
      idea_id: ideaId,
      draft_content: draft,
      final_content: draft,
      status: "draft",
    })
    .select()
    .single();

  if (postError) throw postError;

  // Mark idea as used
  await supabase
    .from("daily_ideas")
    .update({ status: "used" })
    .eq("id", ideaId);

  return { post, articles };
}
