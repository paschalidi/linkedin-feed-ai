import { prisma } from "@/lib/prisma";

/**
 * Write an entry to the automation log.
 * All cron jobs should call this to record their runs.
 */
export async function logAutomationJob(
  jobType: string,
  status: "success" | "failed" | "skipped",
  details?: string
) {
  try {
    await prisma.automationLog.create({
      data: { jobType, status, details },
    });
  } catch (err) {
    console.error("Failed to write automation log:", err);
  }
}
