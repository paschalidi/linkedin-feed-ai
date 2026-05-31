"use server";

import { prisma } from "@/lib/prisma";
import { syncAllRSSFeeds } from "@/app/(app)/sources/rss-actions";
import { generateDailyIdeas } from "@/lib/automation/generate-ideas";
import { processPublishQueue } from "@/lib/automation/publish-queue";

export async function testRssSync() {
  try {
    const results = await syncAllRSSFeeds();
    const totalIngested = results.reduce((sum, r) => sum + r.ingested, 0);
    return { success: true as const, ingested: totalIngested, feeds: results.length };
  } catch (err: any) {
    return { success: false as const, error: err.message };
  }
}

export async function testGenerateIdea() {
  try {
    const result = await generateDailyIdeas({
      articleCount: 5,
      styleAware: true,
      recencyFilter: 30,
    });

    if (!result.success) {
      return result;
    }

    // Persist the generated idea so it shows up on /ideas
    const settings = await prisma.userSettings.findFirst();
    const userId = settings?.userId ?? "default";

    const idea = await prisma.dailyIdea.create({
      data: {
        title: result.title,
        description: result.description,
        userId,
        status: "draft",
      },
    });

    return { success: true as const, ideaId: idea.id, title: result.title };
  } catch (err: any) {
    return { success: false as const, error: err.message };
  }
}

export async function testPublishQueue() {
  try {
    const result = await processPublishQueue();
    return { success: true as const, ...result };
  } catch (err: any) {
    return { success: false as const, error: err.message };
  }
}
