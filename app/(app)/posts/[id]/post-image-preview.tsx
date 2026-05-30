"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, ImageIcon } from "lucide-react";

interface PostImagePreviewProps {
  postId: string;
}

export default function PostImagePreview({ postId }: PostImagePreviewProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const imageUrl = `/api/posts/${postId}/image?t=${refreshKey}`;

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
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>
      <div className="rounded-lg border overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Branded post preview"
          className="w-full h-auto"
          loading="lazy"
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
