import { prisma } from "../lib/prisma";

async function main() {
  console.log("=== PUBLISH QUEUE STATUS ===\n");

  const settings = await prisma.userSettings.findFirst();
  console.log("Settings:", {
    timezone: settings?.timezone || "UTC",
    preferredTime: settings?.preferredPostingTime || "09:00",
    maxPostsPerDay: settings?.maxPostsPerDay ?? 1,
    autoPublish: settings?.autoPublishApproved ?? false,
  });

  const pendingItems = await prisma.publishQueue.findMany({
    where: { status: "pending" },
    include: { post: { include: { idea: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  console.log("\n=== PENDING QUEUE ITEMS ===");
  if (pendingItems.length === 0) {
    console.log("No pending items in queue.");
  } else {
    pendingItems.forEach((item, i) => {
      console.log(`${i + 1}. Post: ${item.post.id.slice(0, 8)}...`);
      console.log(`   Scheduled: ${item.scheduledAt.toISOString()}`);
      console.log(`   Idea: ${item.post.idea?.title || "No idea linked"}`);
      console.log(`   Content preview: ${(item.post.finalContent || item.post.draftContent).slice(0, 80)}...`);
      console.log("");
    });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const publishedToday = await prisma.generatedPost.count({
    where: {
      publishedToLinkedInAt: {
        gte: todayStart,
        lt: todayEnd,
      },
    },
  });

  console.log("=== PUBLISHED TODAY ===");
  console.log(`Published today: ${publishedToday} / ${settings?.maxPostsPerDay ?? 1}`);

  const logs = await prisma.automationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  console.log("\n=== RECENT AUTOMATION LOGS ===");
  logs.forEach((log) => {
    console.log(`${log.jobType}: ${log.status} - ${log.details?.slice(0, 60) || "No details"}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
