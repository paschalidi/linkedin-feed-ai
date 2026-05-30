"use client";

import { useState, useEffect, useRef } from "react";
import { saveIdeaTitle } from "../actions";

export function TitleEditor({
  ideaId,
  initialTitle,
}: {
  ideaId: string;
  initialTitle: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip auto-save on initial mount
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("saving");

    debounceRef.current = setTimeout(async () => {
      try {
        await saveIdeaTitle(ideaId, title);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Title save failed:", err);
        setSaveStatus("idle");
      }
    }, 1000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title, ideaId]);

  return (
    <div className="relative group">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={[
          "w-full bg-transparent text-4xl font-bold tracking-tight",
          "border-b-2 border-transparent outline-none",
          "transition-colors duration-150",
          "focus:border-b-2 focus:border-primary/40",
          "hover:border-b-2 hover:border-muted-foreground/20",
        ].join(" ")}
        aria-label="Post title"
      />
      {saveStatus !== "idle" && (
        <span className="absolute -bottom-5 left-0 text-xs text-muted-foreground">
          {saveStatus === "saving" ? "Saving..." : "Saved"}
        </span>
      )}
    </div>
  );
}
