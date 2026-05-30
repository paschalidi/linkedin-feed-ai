"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, ImageIcon, AlertCircle } from "lucide-react";

interface PostImagePreviewProps {
  postId: string;
}

export default function PostImagePreview({ postId }: PostImagePreviewProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imageUrl = `/api/posts/${postId}/image?t=${refreshKey}`;

  const handleRefresh = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setError("Failed to generate image. Try again.");
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-base font-medium flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Branded Image
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-xs"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw
            className={`h-3 w-3 mr-1 ${isLoading ? "animate-spin" : ""}`}
          />
          {isLoading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-lg border overflow-hidden relative min-h-[200px] bg-muted/30">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={imageUrl}
          src={imageUrl}
          alt="Branded post preview"
          className="w-full h-auto"
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>

      <a
        href={imageUrl}
        download={`linkedin-post-${postId.slice(0, 8)}.png`}
      >
        <Button variant="outline" size="sm" className="w-full">
          <Download className="h-4 w-4 mr-2" />
          Download PNG
        </Button>
      </a>
      <p className="text-xs text-muted-foreground">
        1080 x 1350 px — mobile-optimised for LinkedIn
      </p>
    </div>
  );
}
