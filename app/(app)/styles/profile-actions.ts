"use server";

import { prisma } from "@/lib/prisma";
import {
  startLinkedInScrape,
  checkScrapeStatus,
  fetchFromDatasetUrl,
} from "@/lib/apify";

export async function getLinkedInProfiles() {
  try {
    return await prisma.linkedInProfile.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("getLinkedInProfiles error:", err);
    return [];
  }
}

export async function addLinkedInProfile(url: string) {
  try {
    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http")) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Basic validation
    if (!normalizedUrl.includes("linkedin.com/in/")) {
      throw new Error(
        "Please provide a valid LinkedIn profile URL (e.g., https://linkedin.com/in/username)"
      );
    }

    // Check for duplicate
    const existing = await prisma.linkedInProfile.findUnique({
      where: { profileUrl: normalizedUrl },
    });
    if (existing) {
      throw new Error("This profile has already been added.");
    }

    // Start scrape (fire-and-forget)
    const runId = await startLinkedInScrape(normalizedUrl);

    // Store profile with pending runId
    const profile = await prisma.linkedInProfile.create({
      data: {
        profileUrl: normalizedUrl,
        apifyRunId: runId,
        postCount: 0,
      },
    });

    return profile;
  } catch (err: any) {
    console.error("addLinkedInProfile error:", err);
    throw new Error(err?.message || "Failed to add LinkedIn profile");
  }
}

export async function resyncLinkedInProfile(id: string) {
  try {
    const profile = await prisma.linkedInProfile.findUnique({
      where: { id },
    });
    if (!profile) {
      throw new Error("Profile not found");
    }

    // Start new scrape
    const runId = await startLinkedInScrape(profile.profileUrl);

    // Update profile with new runId
    const updated = await prisma.linkedInProfile.update({
      where: { id },
      data: {
        apifyRunId: runId,
      },
    });

    return updated;
  } catch (err: any) {
    console.error("resyncLinkedInProfile error:", err);
    throw new Error(err?.message || "Failed to resync LinkedIn profile");
  }
}

export async function checkLinkedInScrapeStatus(id: string) {
  try {
    const profile = await prisma.linkedInProfile.findUnique({
      where: { id },
    });
    if (!profile) {
      throw new Error("Profile not found");
    }

    if (!profile.apifyRunId) {
      return { status: "idle" as const };
    }

    const result = await checkScrapeStatus(profile.apifyRunId);

    if (result.status === "running") {
      return { status: "running" as const, message: result.message };
    }

    if (result.status === "failed") {
      // Clear runId so user can retry
      await prisma.linkedInProfile.update({
        where: { id },
        data: { apifyRunId: null },
      });
      return { status: "failed" as const, message: result.message };
    }

    // Succeeded — update profile with posts
    const posts = result.posts;
    const displayName = result.displayName;

    if (posts.length === 0) {
      await prisma.linkedInProfile.update({
        where: { id },
        data: { apifyRunId: null, postCount: 0 },
      });
      return {
        status: "failed" as const,
        message:
          "No posts found for this profile. The profile may be private or have no public posts.",
      };
    }

    await prisma.linkedInProfile.update({
      where: { id },
      data: {
        displayName: displayName || profile.displayName,
        postsJson: JSON.stringify(posts),
        lastSyncedAt: new Date(),
        postCount: posts.length,
        apifyRunId: null,
      },
    });

    return {
      status: "succeeded" as const,
      postCount: posts.length,
      displayName: displayName || profile.displayName,
    };
  } catch (err: any) {
    console.error("checkLinkedInScrapeStatus error:", err);
    throw new Error(
      err?.message || "Failed to check LinkedIn scrape status"
    );
  }
}

export async function removeLinkedInProfile(id: string) {
  try {
    await prisma.linkedInProfile.delete({
      where: { id },
    });
  } catch (err: any) {
    console.error("removeLinkedInProfile error:", err);
    throw new Error(err?.message || "Failed to remove LinkedIn profile");
  }
}

export async function fetchFromDatasetUrlAction(
  id: string,
  datasetUrl: string
) {
  try {
    const profile = await prisma.linkedInProfile.findUnique({
      where: { id },
    });
    if (!profile) {
      throw new Error("Profile not found");
    }

    const { posts, displayName } = await fetchFromDatasetUrl(datasetUrl);

    if (posts.length === 0) {
      throw new Error("No posts found in the provided dataset URL.");
    }

    await prisma.linkedInProfile.update({
      where: { id },
      data: {
        displayName: displayName || profile.displayName,
        postsJson: JSON.stringify(posts),
        lastSyncedAt: new Date(),
        postCount: posts.length,
        apifyRunId: null,
      },
    });

    return { success: true, postCount: posts.length, displayName };
  } catch (err: any) {
    console.error("fetchFromDatasetUrlAction error:", err);
    throw new Error(err?.message || "Failed to fetch dataset");
  }
}

export async function generateStyleFingerprint() {
  try {
    const profiles = await prisma.linkedInProfile.findMany();

    if (profiles.length === 0) {
      throw new Error(
        "No LinkedIn profiles added. Add at least one profile first."
      );
    }

    // Collect all posts
    const allPosts: { text: string; profileName: string | null }[] = [];
    for (const profile of profiles) {
      if (!profile.postsJson) continue;
      const posts = JSON.parse(profile.postsJson) as Array<{
        text: string;
      }>;
      for (const post of posts) {
        if (post.text && post.text.trim().length > 20) {
          allPosts.push({
            text: post.text.trim(),
            profileName: profile.displayName,
          });
        }
      }
    }

    if (allPosts.length === 0) {
      throw new Error("No posts found in any profile.");
    }

    // Sample 30 random posts (or all if fewer)
    const shuffled = allPosts.sort(() => 0.5 - Math.random());
    const sample = shuffled.slice(0, 30);

    // Build analysis prompt
    const postsText = sample
      .map(
        (p, i) =>
          `POST ${i + 1}${p.profileName ? ` (from ${p.profileName})` : ""}:\n${p.text}`
      )
      .join("\n\n---\n\n");

    const { analyzeWritingStyle } = await import("@/lib/claude");
    const styleGuide = await analyzeWritingStyle(postsText);

    // Upsert the "Cloned Voice" style profile
    const existing = await prisma.styleProfile.findFirst({
      where: { isClonedVoice: true },
    });

    if (existing) {
      await prisma.styleProfile.update({
        where: { id: existing.id },
        data: {
          name: "Cloned Voice",
          promptText: styleGuide,
          isActive: true,
        },
      });
    } else {
      // Deactivate others and create cloned voice
      await prisma.styleProfile.updateMany({
        data: { isActive: false },
      });
      await prisma.styleProfile.create({
        data: {
          name: "Cloned Voice",
          promptText: styleGuide,
          isActive: true,
          isClonedVoice: true,
        },
      });
    }

    return { success: true, postCount: allPosts.length };
  } catch (err: any) {
    console.error("generateStyleFingerprint error:", err);
    throw new Error(
      err?.message || "Failed to generate style fingerprint"
    );
  }
}
