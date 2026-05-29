import { prisma } from "./prisma";

interface ScrapedPost {
  text: string;
  postedAt?: string | null;
  url?: string | null;
  engagement?: {
    likes: number;
    comments: number;
  };
}

/**
 * Fetch a random sample of posts from all stored LinkedIn profiles.
 * Used to inject few-shot examples when generating with a cloned voice.
 */
export async function getRandomSamplePosts(count: number = 3): Promise<string[]> {
  const profiles = await prisma.linkedInProfile.findMany({
    select: { postsJson: true },
  });

  const allPosts: string[] = [];

  for (const profile of profiles) {
    if (!profile.postsJson) continue;
    try {
      const posts = JSON.parse(profile.postsJson) as ScrapedPost[];
      for (const post of posts) {
        if (post.text && post.text.trim().length > 20) {
          allPosts.push(post.text.trim());
        }
      }
    } catch {
      // Skip malformed JSON
    }
  }

  if (allPosts.length === 0) return [];

  // Shuffle and sample
  const shuffled = allPosts.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
