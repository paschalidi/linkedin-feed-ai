"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { regenerateAndRefresh } from "./regenerate-action";

export function RegenerateButton({ postId }: { postId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setIsLoading(true);
    try {
      const { id: newId } = await regenerateAndRefresh(postId);
      router.push(`/posts/${newId}`);
    } catch {
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
