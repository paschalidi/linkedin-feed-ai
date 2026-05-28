"use server";

import { createClient } from "@/lib/supabase/server";

export async function getSources() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("newsletter_sources")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getSources error:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("getSources exception:", err);
    return [];
  }
}

export async function addSource(formData: FormData) {
  try {
    const supabase = await createClient();
    const name = formData.get("name") as string;
    const type = formData.get("type") as "rss" | "manual";
    const url = formData.get("url") as string;

    const { data, error } = await supabase
      .from("newsletter_sources")
      .insert({ name, type, url: url || null })
      .select()
      .single();

    if (error) {
      console.error("addSource error:", error.message);
      throw new Error("Failed to add source. Make sure database tables are set up.");
    }
    return data;
  } catch (err: any) {
    console.error("addSource exception:", err);
    throw new Error(err?.message || "Failed to add source");
  }
}

export async function deleteSource(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("newsletter_sources")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("deleteSource error:", error.message);
      throw new Error("Failed to delete source");
    }
  } catch (err: any) {
    console.error("deleteSource exception:", err);
    throw new Error(err?.message || "Failed to delete source");
  }
}
