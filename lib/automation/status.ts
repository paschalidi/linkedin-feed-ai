import { prisma } from "@/lib/prisma";

export interface AutomationStatus {
  nextRssSync: string;
  nextIdeaGen: string;
  queueLength: number;
  nextPublish: string | null;
  recentLogs: Array<{
    id: string;
    jobType: string;
    status: string;
    details: string | null;
    createdAt: Date;
  }>;
}

/**
 * Compute automation status summary for the dashboard.
 */
export async function getAutomationStatus(): Promise<AutomationStatus> {
  const settings = await prisma.userSettings.findFirst();
  const timezone = settings?.timezone || "UTC";
  const preferredTime = settings?.preferredPostingTime || "09:00";

  // Next RSS sync: every 2 days, last successful log determines base
  const lastRssLog = await prisma.automationLog.findFirst({
    where: { jobType: "rss-sync", status: "success" },
    orderBy: { createdAt: "desc" },
  });

  let nextRssSync: string;
  if (lastRssLog) {
    const lastDate = new Date(lastRssLog.createdAt);
    const nextDate = new Date(lastDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    nextRssSync = nextDate.toLocaleDateString("en-US", { timeZone: timezone });
  } else {
    nextRssSync = "Soon (no previous sync)";
  }

  // Next idea generation: daily at preferred time
  const lastIdeaLog = await prisma.automationLog.findFirst({
    where: { jobType: "generate-ideas", status: "success" },
    orderBy: { createdAt: "desc" },
  });

  let nextIdeaGen: string;
  if (lastIdeaLog) {
    const lastDate = new Date(lastIdeaLog.createdAt);
    const nextDate = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000);
    nextIdeaGen = nextDate.toLocaleDateString("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
    });
  } else {
    nextIdeaGen = "Today";
  }

  // Queue status
  const queueItems = await prisma.publishQueue.findMany({
    where: { status: "pending" },
    orderBy: { scheduledAt: "asc" },
    take: 1,
  });

  const queueLength = await prisma.publishQueue.count({
    where: { status: "pending" },
  });

  const nextPublish =
    queueItems.length > 0
      ? new Date(queueItems[0].scheduledAt).toLocaleString("en-US", {
          timeZone: timezone,
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  // Recent logs (last 5)
  const recentLogs = await prisma.automationLog.findMany({
    select: { id: true, jobType: true, status: true, details: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return {
    nextRssSync,
    nextIdeaGen,
    queueLength,
    nextPublish,
    recentLogs,
  };
}
