"use server";

import { prisma } from "@/lib/prisma";

export async function getStyleProfiles() {
  try {
    return await prisma.styleProfile.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("getStyleProfiles error:", err);
    return [];
  }
}

export async function addStyleProfile(formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const promptText = formData.get("prompt_text") as string;
    const isActive = formData.get("is_active") === "on";

    return await prisma.styleProfile.create({
      data: {
        name,
        promptText,
        isActive,
      },
    });
  } catch (err: any) {
    console.error("addStyleProfile error:", err);
    throw new Error(err?.message || "Failed to create style profile");
  }
}

export async function deleteStyleProfile(id: string) {
  try {
    await prisma.styleProfile.delete({
      where: { id },
    });
  } catch (err: any) {
    console.error("deleteStyleProfile error:", err);
    throw new Error(err?.message || "Failed to delete profile");
  }
}

export async function setActiveProfile(id: string) {
  try {
    // Deactivate all
    await prisma.styleProfile.updateMany({
      data: { isActive: false },
    });
    
    // Activate selected
    await prisma.styleProfile.update({
      where: { id },
      data: { isActive: true },
    });
  } catch (err: any) {
    console.error("setActiveProfile error:", err);
    throw new Error(err?.message || "Failed to set active profile");
  }
}

export async function updateStyleProfile(id: string, name: string, promptText: string) {
  try {
    return await prisma.styleProfile.update({
      where: { id },
      data: { name, promptText },
    });
  } catch (err: any) {
    console.error("updateStyleProfile error:", err);
    throw new Error(err?.message || "Failed to update style profile");
  }
}
