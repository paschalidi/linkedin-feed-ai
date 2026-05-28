"use server";

import { prisma } from "@/lib/prisma";

export async function getSources() {
  try {
    return await prisma.newsletterSource.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("getSources error:", err);
    return [];
  }
}

export async function addSource(formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const type = formData.get("type") as "rss" | "manual";
    const url = formData.get("url") as string;

    return await prisma.newsletterSource.create({
      data: {
        name,
        type,
        url: url || null,
      },
    });
  } catch (err: any) {
    console.error("addSource error:", err);
    throw new Error(err?.message || "Failed to add source");
  }
}

export async function deleteSource(id: string) {
  try {
    await prisma.newsletterSource.delete({
      where: { id },
    });
  } catch (err: any) {
    console.error("deleteSource error:", err);
    throw new Error(err?.message || "Failed to delete source");
  }
}
