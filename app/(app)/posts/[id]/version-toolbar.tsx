"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { navigateVersion } from "../actions";

export function VersionToolbar({
  postId,
  currentIndex,
  totalVersions,
}: {
  postId: string;
  currentIndex: number;
  totalVersions: number;
}) {
  const [isNavigating, setIsNavigating] = useState(false);

  async function go(direction: "prev" | "next") {
    setIsNavigating(true);
    try {
      await navigateVersion(postId, direction);
      window.location.reload();
    } finally {
      setIsNavigating(false);
    }
  }

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < totalVersions - 1;

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="default"
          onClick={() => go("prev")}
          disabled={!canGoPrev || isNavigating}
          className="text-base px-4"
        >
          <ChevronLeft className="h-5 w-5 mr-1" />
          Previous Version
        </Button>

        <div className="px-4 py-1 rounded-md bg-muted text-center min-w-[140px]">
          <span className="text-sm font-medium">
            Version {currentIndex + 1} of {totalVersions}
          </span>
        </div>

        <Button
          variant="outline"
          size="default"
          onClick={() => go("next")}
          disabled={!canGoNext || isNavigating}
          className="text-base px-4"
        >
          Next Version
          <ChevronRight className="h-5 w-5 ml-1" />
        </Button>
      </div>

      {isNavigating && (
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <RotateCcw className="h-3.5 w-3.5 animate-spin" />
          Loading...
        </span>
      )}
    </div>
  );
}
