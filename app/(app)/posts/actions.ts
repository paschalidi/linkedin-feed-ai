"use server";

import { prisma } from "@/lib/prisma";

export async function getPost(id: string) {
  try {
    return await prisma.generatedPost.findUnique({
      where: { id },
      include: { idea: true },
    });
  } catch (err: any) {
    console.error("getPost error:", err);
    throw new Error(err?.message || "Failed to get post");
  }
}

export async function updatePost(formData: FormData) {
  try {
    const id = formData.get("id") as string;
    const finalContent = formData.get("final_content") as string;
    const status = formData.get("status") as string;

    return await prisma.generatedPost.update({
      where: { id },
      data: {
        finalContent,
        status,
      },
    });
  } catch (err: any) {
    console.error("updatePost error:", err);
    throw new Error(err?.message || "Failed to update post");
  }
}
