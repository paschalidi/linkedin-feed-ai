"use server";

import { prisma } from "@/lib/prisma";

/**
 * Calculate the next preferred posting time based on settings.
 * If the preferred time has already passed today, returns tomorrow at that time.
 */
export async function getNextPreferredPostingTime(): Promise<Date> {
  const settings = await prisma.userSettings.findFirst();
  const timezone = settings?.timezone || "UTC";
  const preferredTime = settings?.preferredPostingTime || "09:00";

  const [hours, minutes] = preferredTime.split(":").map(Number);

  // Get current time in user's timezone
  const now = new Date();
  const tzDateStr = now.toLocaleString("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // Parse the timezone-local date
  const [datePart, timePart] = tzDateStr.split(", ");
  const [month, day, year] = datePart.split("/");
  const [currentHour, currentMinute] = timePart.split(":").map(Number);

  // Check if preferred time has passed today in user's timezone
  const preferredPassedToday =
    currentHour > hours || (currentHour === hours && currentMinute >= minutes);

  // Calculate target date in user's timezone
  const targetDay = preferredPassedToday ? parseInt(day) + 1 : parseInt(day);
  const targetDateStr = `${year}-${month}-${String(targetDay).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;

  // Convert target date from timezone to UTC
  const targetDate = new Date(targetDateStr);
  // Adjust for timezone offset
  const tzOffset = getTimezoneOffsetHours(timezone);
  return new Date(targetDate.getTime() - tzOffset * 60 * 60 * 1000);
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
