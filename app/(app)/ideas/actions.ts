"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function getIdeas() {
  try {
    return await prisma.dailyIdea.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("getIdeas error:", err);
    return [];
  }
}

export async function addIdea(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const title = formData.get("title") as string;
    const description = formData.get("description") as string;

    return await prisma.dailyIdea.create({
      data: {
        title,
        description,
        userId: user.id,
        status: "draft",
      },
    });
  } catch (err: any) {
    console.error("addIdea error:", err);
    throw new Error(err?.message || "Failed to add idea");
  }
}

export async function archiveIdea(id: string) {
  try {
    await prisma.dailyIdea.update({
      where: { id },
      data: { status: "archived" },
    });
  } catch (err: any) {
    console.error("archiveIdea error:", err);
    throw new Error(err?.message || "Failed to archive idea");
  }
}

export async function reuseIdea(id: string) {
  try {
    await prisma.dailyIdea.update({
      where: { id },
      data: { status: "draft" },
    });
  } catch (err: any) {
    console.error("reuseIdea error:", err);
    throw new Error(err?.message || "Failed to reuse idea");
  }
}

export async function generatePostFromIdea(ideaId: string, styleProfileId: string) {
  try {
    const { generatePost } = await import("@/app/(app)/compose/actions");
    const formData = new FormData();
    formData.append("idea_ids", ideaId);
    formData.append("style_profile_id", styleProfileId);
    const post = await generatePost(formData);
    return { success: true as const, postId: post.id };
  } catch (err: any) {
    console.error("generatePostFromIdea error:", err);
    return { success: false as const, error: err?.message || "Failed to generate post" };
  }
}
