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
