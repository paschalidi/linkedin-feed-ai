"use server";

import { prisma } from "@/lib/prisma";

/**
 * Calculate the next preferred posting time based on settings.
 * If the preferred time has already passed today, returns tomorrow at that time.
 * Handles month/year rollover correctly.
 */
export async function getNextPreferredPostingTime(): Promise<Date> {
  const settings = await prisma.userSettings.findFirst();
  const timezone = settings?.timezone || "UTC";
  const preferredTime = settings?.preferredPostingTime || "09:00";

  const [preferredHour, preferredMinute] = preferredTime.split(":").map(Number);

  // Get current time in user's timezone
  const now = new Date();
  const tzDateStr = now.toLocaleString("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Parse: "05/31/2026, 14:30" → [month, day, year, hour, minute]
  const [datePart, timePart] = tzDateStr.split(", ");
  const [month, day, year] = datePart.split("/").map(Number);
  const [currentHour, currentMinute] = timePart.split(":").map(Number);

  // Check if preferred time has passed today
  const preferredPassedToday =
    currentHour > preferredHour ||
    (currentHour === preferredHour && currentMinute >= preferredMinute);

  // Build target date string in user's timezone
  // Use UTC constructor with timezone-adjusted values to avoid rollover bugs
  const tzOffset = getTimezoneOffsetHours(timezone);
  
  // Create a UTC date representing "today" in the user's timezone
  const todayInTz = new Date(Date.UTC(year, month - 1, day, preferredHour, preferredMinute));
  
  // If preferred time passed, add 1 day
  if (preferredPassedToday) {
    todayInTz.setUTCDate(todayInTz.getUTCDate() + 1);
  }

  // Adjust for timezone offset to get the actual UTC time
  return new Date(todayInTz.getTime() - tzOffset * 60 * 60 * 1000);
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
