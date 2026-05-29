import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkScrapeStatus } from "@/lib/apify";

/**
 * Apify webhook handler.
 *
 * Apify calls this endpoint when a run SUCCEEDS or FAILS.
 * We look up the profile by runId, fetch the dataset, and save posts.
 *
 * Security: We verify the runId exists in our DB before doing anything.
 * This prevents random webhook calls from affecting our data.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const runId = body?.runId;
    const status = body?.status;

    if (!runId || !status) {
      return new Response("Missing runId or status", { status: 400 });
    }

    // Find the profile with this runId
    const profile = await prisma.linkedInProfile.findFirst({
      where: { apifyRunId: runId },
    });

    if (!profile) {
      // RunId doesn't belong to us — silently ignore
      console.warn(`Webhook received for unknown runId: ${runId}`);
      return new Response("OK", { status: 200 });
    }

    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      // Clear runId so user can retry
      await prisma.linkedInProfile.update({
        where: { id: profile.id },
        data: { apifyRunId: null },
      });
      console.log(`Webhook: run ${runId} failed with status ${status}`);
      return new Response("OK", { status: 200 });
    }

    if (status === "SUCCEEDED") {
      // Fetch dataset and save posts
      const result = await checkScrapeStatus(runId);

      if (result.status !== "succeeded") {
        console.error(`Webhook: run ${runId} reported SUCCEEDED but checkScrapeStatus returned ${result.status}`);
        await prisma.linkedInProfile.update({
          where: { id: profile.id },
          data: { apifyRunId: null },
        });
        return new Response("OK", { status: 200 });
      }

      const posts = result.posts;
      const displayName = result.displayName;

      if (posts.length === 0) {
        await prisma.linkedInProfile.update({
          where: { id: profile.id },
          data: {
            apifyRunId: null,
            postCount: 0,
          },
        });
        console.log(`Webhook: run ${runId} succeeded but no posts found`);
        return new Response("OK", { status: 200 });
      }

      await prisma.linkedInProfile.update({
        where: { id: profile.id },
        data: {
          displayName: displayName || profile.displayName,
          postsJson: JSON.stringify(posts),
          lastSyncedAt: new Date(),
          postCount: posts.length,
          apifyRunId: null,
        },
      });

      console.log(
        `Webhook: run ${runId} succeeded — saved ${posts.length} posts for profile ${profile.id}`
      );
      return new Response("OK", { status: 200 });
    }

    // Unknown status
    return new Response("OK", { status: 200 });
  } catch (err: any) {
    console.error("Apify webhook error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
