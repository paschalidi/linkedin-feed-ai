"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, ImageIcon, AlertCircle } from "lucide-react";
import { IMAGE_WIDTH, IMAGE_HEIGHT } from "@/lib/image-config";

interface PostImagePreviewProps {
  postId: string;
}

export default function PostImagePreview({ postId }: PostImagePreviewProps) {
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // v param busts browser cache after a refresh; regenerate forces server to create a new image
  const imageUrl = `/api/posts/${postId}/image?v=${version}`;
  const refreshUrl = `/api/posts/${postId}/image?v=${version + 1}&regenerate=1`;

  const handleRefresh = useCallback(() => {
    setError(null);
    setIsLoading(true);

    // Fetch the refresh URL to force regeneration, then bump version to show it
    fetch(refreshUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to refresh image");
        setVersion((v) => v + 1);
      })
      .catch(() => {
        setError("Failed to refresh image. Try again.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [refreshUrl]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setError("Failed to load image.");
  }, []);

  return (
    <div className="space-y-3">
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

      {/* Aspect-ratio wrapper — scales to column width at the true 4:5 ratio */}
      <div
        className="relative w-full border rounded-lg overflow-hidden shadow-sm bg-muted"
        style={{ aspectRatio: `${IMAGE_WIDTH} / ${IMAGE_HEIGHT}` }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={imageUrl}
          src={imageUrl}
          alt="Branded post preview"
          width={IMAGE_WIDTH}
          height={IMAGE_HEIGHT}
          className="absolute inset-0 w-full h-full object-cover"
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
      <p className="text-xs text-muted-foreground leading-relaxed">
        <strong>{IMAGE_WIDTH} × {IMAGE_HEIGHT} px</strong> — LinkedIn portrait (4:5).
        The image stays the same when you edit the post text. Click Refresh to regenerate.
      </p>
    </div>
  );
}
