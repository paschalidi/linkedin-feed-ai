"use server";

import { createClient } from "@/lib/supabase/server";

export async function getIdeas() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_ideas")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function addIdea(formData: FormData) {
  const supabase = await createClient();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("daily_ideas")
    .insert({ title, description, user_id: user.id, status: "draft" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function archiveIdea(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_ideas")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) throw error;
}
