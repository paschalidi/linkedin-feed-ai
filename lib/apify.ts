const APIFY_BASE_URL = "https://api.apify.com/v2";

function getApiKey(): string {
  const apiKey = process.env.APIFY_API_TOKEN;
  if (!apiKey) {
    throw new Error(
      "APIFY_API_TOKEN is not set.\n\n" +
        "Add your Apify API token to .env.local:\n" +
        "APIFY_API_TOKEN=your_apify_api_token\n\n" +
        "Get one at: https://console.apify.com/account/integrations"
    );
  }
  return apiKey;
}

interface ApifyPost {
  text?: string;
  postedAtISO?: string;
  postedAtTimestamp?: number;
  url?: string;
  numLikes?: number;
  numComments?: number;
  likes?: number;
  comments?: number;
  authorFullName?: string;
  authorName?: string;
  date?: string;
  likesCount?: number;
  commentsCount?: number;
}

export interface ScrapedPost {
  text: string;
  postedAt: string | null;
  url: string | null;
  engagement: {
    likes: number;
    comments: number;
  };
}

/**
 * Fetch public LinkedIn posts from a profile URL via Apify.
 *
 * Uses the scraper-engine/linkedin-profile-post-scraper actor which has
 * a 100% success rate and good reviews. No cookies required.
 */
export async function fetchLinkedInPosts(
  profileUrl: string
): Promise<{
  posts: ScrapedPost[];
  displayName: string | null;
}> {
  const apiKey = getApiKey();
  const actorId = "scraper-engine~linkedin-profile-post-scraper";

  // 1. Start the actor run
  const runResponse = await fetch(
    `${APIFY_BASE_URL}/acts/${actorId}/runs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        urls: [profileUrl],
        maxPosts: 50,
        proxyConfiguration: { useApifyProxy: false },
      }),
    }
  );

  if (!runResponse.ok) {
    const error = await runResponse.text();
    // Provide helpful guidance for common errors
    if (runResponse.status === 404) {
      throw new Error(
        "Apify actor not found. The actor may have been renamed or removed. " +
          "Check https://apify.com/store for available LinkedIn scrapers."
      );
    }
    if (runResponse.status === 401) {
      throw new Error(
        "Apify API token is invalid. Check your APIFY_API_TOKEN in .env.local"
      );
    }
    throw new Error(`Apify run failed: ${runResponse.status} ${error}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data.id;

  // 2. Poll for completion (max 90s — LinkedIn scraping can take time)
  let status = runData.data.status;
  const maxWait = 90_000;
  const pollInterval = 3000;
  let elapsed = 0;

  while (
    status === "RUNNING" ||
    status === "READY" ||
    status === "REBUILDING"
  ) {
    if (elapsed >= maxWait) {
      throw new Error(
        "Apify scraper timed out after 90 seconds. The actor may be queued. Try again later."
      );
    }
    await new Promise((r) => setTimeout(r, pollInterval));
    elapsed += pollInterval;

    const statusRes = await fetch(
      `${APIFY_BASE_URL}/actor-runs/${runId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    status = statusData.data.status;
  }

  if (status !== "SUCCEEDED") {
    throw new Error(
      `Apify scraper failed with status: ${status}. The profile may be private or LinkedIn blocked the request.`
    );
  }

  // 3. Fetch results from default dataset
  const datasetRes = await fetch(
    `${APIFY_BASE_URL}/actor-runs/${runId}/dataset/items`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!datasetRes.ok) {
    throw new Error(
      `Failed to fetch Apify dataset: ${datasetRes.status}`
    );
  }

  const items: ApifyPost[] = await datasetRes.json();

  const posts: ScrapedPost[] = items
    .filter((item) => item.text && item.text.trim().length > 10)
    .map((item) => ({
      text: item.text!.trim(),
      postedAt: item.postedAtISO || item.date || null,
      url: item.url || null,
      engagement: {
        likes: item.numLikes ?? item.likes ?? item.likesCount ?? 0,
        comments: item.numComments ?? item.comments ?? item.commentsCount ?? 0,
      },
    }));

  const displayName = items[0]?.authorFullName || items[0]?.authorName || null;

  return { posts, displayName };
}
