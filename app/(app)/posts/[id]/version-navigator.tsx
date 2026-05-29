"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { navigateVersion } from "../actions";

export function VersionNavigator({
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
      // Force page reload to show the selected version
      window.location.reload();
    } finally {
      setIsNavigating(false);
    }
  }

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < totalVersions - 1;

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => go("prev")}
        disabled={!canGoPrev || isNavigating}
        className="text-base"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Prev
      </Button>

      <span className="text-sm text-muted-foreground min-w-[100px] text-center">
        Version {currentIndex + 1} of {totalVersions}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => go("next")}
        disabled={!canGoNext || isNavigating}
        className="text-base"
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
