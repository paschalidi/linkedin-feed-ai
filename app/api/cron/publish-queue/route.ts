import { NextRequest, NextResponse } from "next/server";
import { processPublishQueue } from "@/lib/automation/publish-queue";

/**
 * Publish queue processor cron.
 * Runs hourly but only publishes 1 post per run (if any are ready).
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
    const result = await processPublishQueue();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
