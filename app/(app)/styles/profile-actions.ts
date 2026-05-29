"use server";

import { prisma } from "@/lib/prisma";
import { fetchLinkedInPosts } from "@/lib/apify";

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

    // Scrape via Apify
    const { posts, displayName } = await fetchLinkedInPosts(normalizedUrl);

    if (posts.length === 0) {
      throw new Error(
        "No posts found for this profile. The profile may be private or have no public posts."
      );
    }

    // Store in DB
    const profile = await prisma.linkedInProfile.create({
      data: {
        profileUrl: normalizedUrl,
        displayName: displayName || null,
        postsJson: JSON.stringify(posts),
        lastSyncedAt: new Date(),
        postCount: posts.length,
      },
    });

    return profile;
  } catch (err: any) {
    console.error("addLinkedInProfile error:", err);
    throw new Error(
      err?.message || "Failed to add LinkedIn profile"
    );
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

    const { posts, displayName } = await fetchLinkedInPosts(
      profile.profileUrl
    );

    if (posts.length === 0) {
      throw new Error(
        "No posts found during resync. The profile may have become private."
      );
    }

    const updated = await prisma.linkedInProfile.update({
      where: { id },
      data: {
        postsJson: JSON.stringify(posts),
        displayName: displayName || profile.displayName,
        lastSyncedAt: new Date(),
        postCount: posts.length,
      },
    });

    return updated;
  } catch (err: any) {
    console.error("resyncLinkedInProfile error:", err);
    throw new Error(
      err?.message || "Failed to resync LinkedIn profile"
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
    throw new Error(
      err?.message || "Failed to remove LinkedIn profile"
    );
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

    // Import Claude analysis function dynamically to avoid issues if claude.ts has side effects
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
