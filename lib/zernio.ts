/**
 * Zernio API client for posting to LinkedIn.
 * Docs: https://docs.zernio.com
 */

const ZERNIO_BASE_URL = "https://zernio.com/api/v1";

interface ZernioPostPayload {
  content: string;
  platforms: Array<{
    platform: "linkedin";
    accountId: string;
    platformSpecificData?: {
      firstComment?: string;
      disableLinkPreview?: boolean;
    };
  }>;
  publishNow: boolean;
}

interface ZernioPostResponse {
  post: {
    _id: string;
    status: string;
    platforms: Array<{
      platform: string;
      accountId: string;
      status: string;
      postUrl?: string;
    }>;
  };
}

export async function createLinkedInPost(
  content: string,
  accountId: string
): Promise<{ postId: string; postUrl?: string }> {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ZERNIO_API_KEY is not configured. Add it to your .env.local file."
    );
  }

  if (!accountId) {
    throw new Error(
      "ZERNIO_LINKEDIN_ACCOUNT_ID is not configured. Add it to your .env.local file."
    );
  }

  const payload: ZernioPostPayload = {
    content,
    platforms: [
      {
        platform: "linkedin",
        accountId,
      },
    ],
    publishNow: true,
  };

  const res = await fetch(`${ZERNIO_BASE_URL}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await res.text();

  if (!res.ok) {
    let errorDetail = responseText;
    try {
      const parsed = JSON.parse(responseText);
      errorDetail = parsed.message || parsed.error || JSON.stringify(parsed);
    } catch {
      // use raw text
    }
    throw new Error(`Zernio API error (${res.status}): ${errorDetail}`);
  }

  let data: ZernioPostResponse;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error("Zernio returned invalid JSON: " + responseText);
  }

  const linkedInPlatform = data.post.platforms.find(
    (p) => p.platform === "linkedin"
  );

  return {
    postId: data.post._id,
    postUrl: linkedInPlatform?.postUrl,
  };
}
