"use server";

import { createClient } from "@/lib/supabase/server";

export async function getStyleProfiles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("style_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function addStyleProfile(formData: FormData) {
  const supabase = await createClient();
  const name = formData.get("name") as string;
  const prompt_text = formData.get("prompt_text") as string;
  const is_active = formData.get("is_active") === "on";

  const { data, error } = await supabase
    .from("style_profiles")
    .insert({ name, prompt_text, is_active })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteStyleProfile(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("style_profiles")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function setActiveProfile(id: string) {
  const supabase = await createClient();
  
  // First, unset all active profiles
  await supabase
    .from("style_profiles")
    .update({ is_active: false })
    .neq("id", "0");
  
  // Then set the chosen one as active
  const { error } = await supabase
    .from("style_profiles")
    .update({ is_active: true })
    .eq("id", id);

  if (error) throw error;
}
