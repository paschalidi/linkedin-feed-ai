"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, CheckCircle, ExternalLink } from "lucide-react";
import { savePostContent, updatePostStatus, publishToLinkedIn } from "../actions";
import { RegenerateButton } from "./regenerate-button";

export function PostEditor({
  postId,
  initialContent,
  isPublished,
}: {
  postId: string;
  initialContent: string;
  isPublished: boolean;
}) {
  const [content, setContent] = useState(initialContent);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [publishResult, setPublishResult] = useState<{
    success: boolean;
    postId?: string;
    postUrl?: string;
  } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [approved, setApproved] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setSaveStatus("saving");
    debounceRef.current = setTimeout(async () => {
      try {
        await savePostContent(postId, content);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err: any) {
        console.error("Auto-save failed:", err);
        setSaveStatus("idle");
      }
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [content, postId]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApprove = async () => {
    try {
      await updatePostStatus(postId, "approved");
      setApproved(true);
      setTimeout(() => setApproved(false), 2000);
    } catch (err: any) {
      console.error("Approve failed:", err);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishError(null);
    setPublishResult(null);

    try {
      const res = await publishToLinkedIn(postId, content);
      setPublishResult(res);
    } catch (err: any) {
      setPublishError(err?.message || "Failed to publish");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="relative">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={20}
          className="font-mono text-base leading-relaxed pr-12"
          placeholder="Your LinkedIn post draft..."
        />
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2 right-2 p-2 rounded-md hover:bg-muted transition-colors"
          title={copied ? "Copied!" : "Copy to clipboard"}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Button
          type="button"
          variant="default"
          className="text-base"
          onClick={handleApprove}
          disabled={approved}
        >
          <CheckCircle className="h-5 w-5 mr-2" />
          {approved ? "Approved!" : "Approve"}
        </Button>

        {!isPublished && !publishResult?.success && (
          <Button
            type="button"
            variant="outline"
            className="text-base border-blue-600 text-blue-600 hover:bg-blue-50"
            onClick={handlePublish}
            disabled={isPublishing}
          >
            <ExternalLink className="h-5 w-5 mr-2" />
            {isPublishing ? "Publishing..." : "Post to LinkedIn"}
          </Button>
        )}

        {publishResult?.success && (
          <span className="text-sm text-green-600 font-medium">
            Published!
          </span>
        )}

        <RegenerateButton postId={postId} />

        <div className="ml-auto flex items-center gap-2">
          {saveStatus === "saving" && (
            <span className="text-xs text-muted-foreground">Saving...</span>
          )}
          {saveStatus === "saved" && (
            <span className="text-xs text-green-600">Saved</span>
          )}
        </div>
      </div>

      {publishError && (
        <p className="text-sm text-red-600">{publishError}</p>
      )}

      {publishResult?.success && publishResult.postUrl && (
        <a
          href={publishResult.postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          View on LinkedIn
        </a>
      )}
    </div>
  );
}
