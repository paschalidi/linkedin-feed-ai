const APIFY_BASE_URL = "https://api.apify.com/v2";
const ACTOR_ID = "scraper-engine~linkedin-profile-post-scraper";

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

function parsePosts(items: ApifyPost[]): {
  posts: ScrapedPost[];
  displayName: string | null;
} {
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

  const displayName =
    items[0]?.authorFullName || items[0]?.authorName || null;

  return { posts, displayName };
}

/**
 * Start an Apify scrape for a LinkedIn profile.
 * Returns the runId immediately — does NOT wait for completion.
 * The caller is responsible for polling `checkScrapeStatus(runId)`.
 */
export async function startLinkedInScrape(
  profileUrl: string
): Promise<string> {
  const apiKey = getApiKey();

  const runResponse = await fetch(
    `${APIFY_BASE_URL}/acts/${ACTOR_ID}/runs`,
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
  return runData.data.id;
}

export type ScrapeStatus =
  | { status: "running"; message: string }
  | { status: "succeeded"; posts: ScrapedPost[]; displayName: string | null }
  | { status: "failed"; message: string };

/**
 * Check the status of an Apify run.
 * If succeeded, fetches and returns the posts.
 * If still running, returns a status indicator.
 * If failed, returns an error.
 */
export async function checkScrapeStatus(
  runId: string
): Promise<ScrapeStatus> {
  const apiKey = getApiKey();

  const statusRes = await fetch(
    `${APIFY_BASE_URL}/actor-runs/${runId}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!statusRes.ok) {
    throw new Error(`Failed to check Apify run status: ${statusRes.status}`);
  }

  const statusData = await statusRes.json();
  const status = statusData.data.status;

  if (status === "RUNNING" || status === "READY" || status === "REBUILDING") {
    return { status: "running", message: `Scrape status: ${status}` };
  }

  if (status !== "SUCCEEDED") {
    return {
      status: "failed",
      message: `Scraper failed with status: ${status}. The profile may be private or LinkedIn blocked the request.`,
    };
  }

  // Fetch results
  const datasetRes = await fetch(
    `${APIFY_BASE_URL}/actor-runs/${runId}/dataset/items`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!datasetRes.ok) {
    return {
      status: "failed",
      message: `Failed to fetch Apify dataset: ${datasetRes.status}`,
    };
  }

  const items: ApifyPost[] = await datasetRes.json();
  const { posts, displayName } = parsePosts(items);

  return { status: "succeeded", posts, displayName };
}

/**
 * Legacy convenience function: start + wait (up to 90s).
 * Kept for scripts/one-offs. UI should use start + poll.
 */
export async function fetchLinkedInPosts(
  profileUrl: string
): Promise<{
  posts: ScrapedPost[];
  displayName: string | null;
}> {
  const runId = await startLinkedInScrape(profileUrl);

  const maxWait = 90_000;
  const pollInterval = 3000;
  let elapsed = 0;

  while (true) {
    const result = await checkScrapeStatus(runId);

    if (result.status === "succeeded") {
      return {
        posts: result.posts,
        displayName: result.displayName,
      };
    }

    if (result.status === "failed") {
      throw new Error(result.message);
    }

    if (elapsed >= maxWait) {
      throw new Error(
        "Apify scraper timed out after 90 seconds. The actor may still be running. Use the polling UI instead."
      );
    }

    await new Promise((r) => setTimeout(r, pollInterval));
    elapsed += pollInterval;
  }
}
