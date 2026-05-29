"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { publishToLinkedIn } from "../actions";

export function PublishToLinkedInButton({ postId }: { postId: string }) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    postId?: string;
    postUrl?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setIsPublishing(true);
    setError(null);
    setResult(null);

    try {
      const res = await publishToLinkedIn(postId);
      setResult(res);
    } catch (err: any) {
      setError(err?.message || "Failed to publish");
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="text-base border-blue-600 text-blue-600 hover:bg-blue-50"
        onClick={handlePublish}
        disabled={isPublishing || !!result?.success}
      >
        <ExternalLink className="h-5 w-5 mr-2" />
        {isPublishing
          ? "Publishing..."
          : result?.success
          ? "Published!"
          : "Post to LinkedIn"}
      </Button>

      {error && (
        <p className="text-sm text-red-600 max-w-md">{error}</p>
      )}

      {result?.success && result.postUrl && (
        <a
          href={result.postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          View on LinkedIn
        </a>
      )}

      {result?.success && !result.postUrl && (
        <p className="text-sm text-green-600">
          Successfully posted to LinkedIn (ID: {result.postId})
        </p>
      )}
    </div>
  );
}
