"use server";

import { createClient } from "@/lib/supabase/server";

export async function getPost(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generated_posts")
    .select("*, daily_ideas(*)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function updatePost(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const final_content = formData.get("final_content") as string;
  const status = formData.get("status") as string;

  const { data, error } = await supabase
    .from("generated_posts")
    .update({ final_content, status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
