"use server";

import { createClient } from "@/lib/supabase/server";

export async function getIdeas() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("daily_ideas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getIdeas error:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("getIdeas exception:", err);
    return [];
  }
}

export async function addIdea(formData: FormData) {
  try {
    const supabase = await createClient();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("daily_ideas")
      .insert({ title, description, user_id: user.id, status: "draft" })
      .select()
      .single();

    if (error) {
      console.error("addIdea error:", error.message);
      throw new Error("Failed to add idea. Make sure database tables are set up.");
    }
    return data;
  } catch (err: any) {
    console.error("addIdea exception:", err);
    throw new Error(err?.message || "Failed to add idea");
  }
}

export async function archiveIdea(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("daily_ideas")
      .update({ status: "archived" })
      .eq("id", id);

    if (error) {
      console.error("archiveIdea error:", error.message);
      throw new Error("Failed to archive idea");
    }
  } catch (err: any) {
    console.error("archiveIdea exception:", err);
    throw new Error(err?.message || "Failed to archive idea");
  }
}
