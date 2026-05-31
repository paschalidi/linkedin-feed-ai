"use server";

import { prisma } from "@/lib/prisma";

/**
 * Add a post to the publishing queue.
 * Idempotent: updates scheduledAt if post already queued.
 */
export async function addToQueue(postId: string, scheduledAt: Date) {
  try {
    return await prisma.publishQueue.upsert({
      where: { postId },
      update: { scheduledAt, status: "pending" },
      create: {
        postId,
        scheduledAt,
        status: "pending",
      },
    });
  } catch (err: any) {
    console.error("addToQueue error:", err);
    throw new Error(err?.message || "Failed to add to queue");
  }
}

/**
 * Remove a post from the publishing queue.
 */
export async function removeFromQueue(postId: string) {
  try {
    await prisma.publishQueue.deleteMany({
      where: { postId },
    });
  } catch (err: any) {
    console.error("removeFromQueue error:", err);
    throw new Error(err?.message || "Failed to remove from queue");
  }
}

/**
 * Get all pending queue items with post data.
 */
export async function getQueue() {
  try {
    return await prisma.publishQueue.findMany({
      where: { status: "pending" },
      include: { post: { include: { idea: true } } },
      orderBy: { scheduledAt: "asc" },
    });
  } catch (err: any) {
    console.error("getQueue error:", err);
    throw new Error(err?.message || "Failed to get queue");
  }
}

/**
 * Get queue status for a specific post.
 */
export async function getQueueItem(postId: string) {
  try {
    return await prisma.publishQueue.findUnique({
      where: { postId },
    });
  } catch (err: any) {
    console.error("getQueueItem error:", err);
    return null;
  }
}
