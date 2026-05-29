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
    // Cascade delete: chunks → articles → source
    // (DB has ON DELETE SET NULL, so we manually clean up)
    await prisma.$transaction(async (tx) => {
      // 1. Delete all chunks for articles from this source
      await tx.$executeRaw`
        DELETE FROM article_chunks 
        WHERE article_id IN (
          SELECT id FROM articles WHERE source_id = ${id}
        )
      `;
      
      // 2. Delete all articles from this source
      await tx.$executeRaw`
        DELETE FROM articles WHERE source_id = ${id}
      `;
      
      // 3. Delete the source itself
      await tx.$executeRaw`
        DELETE FROM newsletter_sources WHERE id = ${id}
      `;
    });
  } catch (err: any) {
    console.error("deleteSource error:", err);
    throw new Error(err?.message || "Failed to delete source");
  }
}

export async function getSourceArticleCounts() {
  try {
    const result = await prisma.$queryRaw<
      Array<{ source_id: string; count: bigint }>
    >`
      SELECT source_id, COUNT(*) as count
      FROM articles
      WHERE source_id IS NOT NULL
      GROUP BY source_id
    `;
    return Object.fromEntries(
      result.map((row) => [row.source_id, Number(row.count)])
    );
  } catch (err) {
    console.error("getSourceArticleCounts error:", err);
    return {};
  }
}
