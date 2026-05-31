import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDailyIdeas } from "@/lib/automation/generate-ideas";
import { logAutomationJob } from "@/lib/automation/log";

/**
 * Daily idea generation cron.
 * Runs hourly but gates on:
 * 1. UserSettings.autoGenerateIdeas = true
 * 2. Hasn't already run today in user's timezone
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret) {
    const token = authHeader?.replace("Bearer ", "");
    if (token !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const settings = await prisma.userSettings.findFirst();
    if (!settings || !settings.autoGenerateIdeas) {
      await logAutomationJob("generate-ideas", "skipped", "autoGenerateIdeas is OFF");
      return NextResponse.json({ success: true, skipped: "autoGenerateIdeas is OFF" });
    }

    // Gate: check if already ran today in user's timezone
    const now = new Date();
    const tzOffset = getTimezoneOffsetHours(settings.timezone);
    const today = new Date(now.getTime() + tzOffset * 60 * 60 * 1000);
    today.setUTCHours(0, 0, 0, 0);

    const alreadyRan = await prisma.automationLog.findFirst({
      where: {
        jobType: "generate-ideas",
        status: "success",
        createdAt: { gte: today },
      },
    });

    if (alreadyRan) {
      return NextResponse.json({ success: true, skipped: "Already ran today" });
    }

    const result = await generateDailyIdeas({
      articleCount: 5,
      styleAware: true,
      recencyFilter: 7,
    });

    if (!result.success) {
      await logAutomationJob("generate-ideas", "skipped", result.error);
      return NextResponse.json({ success: true, skipped: result.error });
    }

    // Find the user ID to associate with the idea
    const userId = settings.userId;

    await prisma.dailyIdea.create({
      data: {
        title: result.title,
        description: result.description,
        userId,
        status: "draft",
      },
    });

    await logAutomationJob("generate-ideas", "success", `Generated idea: "${result.title}"`);

    return NextResponse.json({ success: true, idea: result.title });
  } catch (error: any) {
    await logAutomationJob("generate-ideas", "failed", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

function getTimezoneOffsetHours(timezone: string): number {
  try {
    const now = new Date();
    const tzDate = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
  } catch {
    return 0;
  }
}
