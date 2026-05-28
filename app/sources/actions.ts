"use server";

import { createClient } from "@/lib/supabase/server";

export async function getSources() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("newsletter_sources")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function addSource(formData: FormData) {
  const supabase = await createClient();
  const name = formData.get("name") as string;
  const type = formData.get("type") as "rss" | "manual";
  const url = formData.get("url") as string;

  const { data, error } = await supabase
    .from("newsletter_sources")
    .insert({ name, type, url: url || null })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSource(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("newsletter_sources")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
