/**
 * Zernio API client for posting to LinkedIn.
 * Docs: https://docs.zernio.com
 */

const ZERNIO_BASE_URL = "https://zernio.com/api/v1";

interface ZernioPostPayload {
  content: string;
  mediaItems?: Array<{
    type: "image" | "video";
    url: string;
    title?: string;
  }>;
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

interface ZernioPresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  type: string;
}

export async function uploadMediaToZernio(
  imageBuffer: Buffer
): Promise<string> {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ZERNIO_API_KEY is not configured. Add it to your .env.local file."
    );
  }

  // Step 1: Get presigned upload URL
  const presignRes = await fetch(`${ZERNIO_BASE_URL}/media/presign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: "linkedin-post-image.png",
      contentType: "image/png",
      size: imageBuffer.length,
    }),
  });

  if (!presignRes.ok) {
    const text = await presignRes.text();
    throw new Error(`Zernio presign failed (${presignRes.status}): ${text}`);
  }

  const presignData: ZernioPresignResponse = await presignRes.json();

  // Step 2: Upload the image directly to the presigned URL
  const uploadRes = await fetch(presignData.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "image/png",
    },
    body: new Uint8Array(imageBuffer),
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Zernio upload failed (${uploadRes.status}): ${text}`);
  }

  // Step 3: Return the public URL to use in the post
  return presignData.publicUrl;
}

export async function createLinkedInPost(
  content: string,
  accountId: string,
  mediaUrl?: string
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

  if (mediaUrl) {
    payload.mediaItems = [
      {
        type: "image",
        url: mediaUrl,
      },
    ];
  }

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
