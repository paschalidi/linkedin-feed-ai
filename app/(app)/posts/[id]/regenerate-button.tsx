"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { regenerateAndRefresh } from "./regenerate-action";

export function RegenerateButton({ postId }: { postId: string }) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    try {
      await regenerateAndRefresh(postId);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      variant="outline"
      className="text-base"
    >
      <RefreshCw
        className={`h-5 w-5 mr-2 ${isLoading ? "animate-spin" : ""}`}
      />
      {isLoading ? "Regenerating..." : "Regenerate"}
    </Button>
  );
}
