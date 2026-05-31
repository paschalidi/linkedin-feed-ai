"use server";

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
      recencyFilter: 7,
    });
    return result;
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
