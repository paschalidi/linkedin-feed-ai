"use server";

import { prisma } from "@/lib/prisma";

const DEFAULT_SETTINGS = {
  autoSyncRss: true,
  autoGenerateIdeas: false,
  autoPublishApproved: false,
  timezone: "UTC",
  preferredPostingTime: "09:00",
  maxPostsPerDay: 1,
};

export async function getSettings() {
  try {
    const settings = await prisma.userSettings.findFirst();
    if (!settings) return DEFAULT_SETTINGS;
    return {
      autoSyncRss: settings.autoSyncRss,
      autoGenerateIdeas: settings.autoGenerateIdeas,
      autoPublishApproved: settings.autoPublishApproved,
      timezone: settings.timezone,
      preferredPostingTime: settings.preferredPostingTime,
      maxPostsPerDay: settings.maxPostsPerDay,
    };
  } catch (err) {
    console.error("getSettings error:", err);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(formData: FormData) {
  try {
    const existing = await prisma.userSettings.findFirst();

    const data = {
      autoSyncRss: formData.get("autoSyncRss") === "on",
      autoGenerateIdeas: formData.get("autoGenerateIdeas") === "on",
      autoPublishApproved: formData.get("autoPublishApproved") === "on",
      timezone: (formData.get("timezone") as string) || "UTC",
      preferredPostingTime: (formData.get("preferredPostingTime") as string) || "09:00",
      maxPostsPerDay: parseInt((formData.get("maxPostsPerDay") as string) || "1", 10),
    };

    if (existing) {
      await prisma.userSettings.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.userSettings.create({
        data: { ...data, userId: "default" },
      });
    }
  } catch (err: any) {
    console.error("saveSettings error:", err);
    throw new Error(err?.message || "Failed to save settings");
  }
}
