"use server";

import { createClient } from "@/lib/supabase/server";

export async function getStyleProfiles() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("style_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getStyleProfiles error:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("getStyleProfiles exception:", err);
    return [];
  }
}

export async function addStyleProfile(formData: FormData) {
  try {
    const supabase = await createClient();
    const name = formData.get("name") as string;
    const prompt_text = formData.get("prompt_text") as string;
    const is_active = formData.get("is_active") === "on";

    const { data, error } = await supabase
      .from("style_profiles")
      .insert({ name, prompt_text, is_active })
      .select()
      .single();

    if (error) {
      console.error("addStyleProfile error:", error.message);
      throw new Error("Failed to create style profile. Make sure database tables are set up.");
    }
    return data;
  } catch (err: any) {
    console.error("addStyleProfile exception:", err);
    throw new Error(err?.message || "Failed to create style profile");
  }
}

export async function deleteStyleProfile(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("style_profiles")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("deleteStyleProfile error:", error.message);
      throw new Error("Failed to delete profile");
    }
  } catch (err: any) {
    console.error("deleteStyleProfile exception:", err);
    throw new Error(err?.message || "Failed to delete profile");
  }
}

export async function setActiveProfile(id: string) {
  try {
    const supabase = await createClient();
    
    await supabase
      .from("style_profiles")
      .update({ is_active: false })
      .neq("id", "0");
    
    const { error } = await supabase
      .from("style_profiles")
      .update({ is_active: true })
      .eq("id", id);

    if (error) {
      console.error("setActiveProfile error:", error.message);
      throw new Error("Failed to set active profile");
    }
  } catch (err: any) {
    console.error("setActiveProfile exception:", err);
    throw new Error(err?.message || "Failed to set active profile");
  }
}
