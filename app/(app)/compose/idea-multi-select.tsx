"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";

export function IdeaMultiSelect({
  ideas,
  preselected,
}: {
  ideas: Array<{ id: string; title: string; description?: string | null }>;
  preselected?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    preselected ? new Set([preselected]) : new Set()
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
        {ideas.map((idea) => {
          const isSelected = selected.has(idea.id);
          return (
            <label
              key={idea.id}
              className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-input hover:bg-accent"
              }`}
            >
              <input
                type="checkbox"
                name="idea_ids"
                value={idea.id}
                checked={isSelected}
                onChange={() => toggle(idea.id)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-primary text-primary focus:ring-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Lightbulb
                    className={`h-4 w-4 shrink-0 ${
                      isSelected ? "text-primary" : "text-yellow-500"
                    }`}
                  />
                  <span className="font-medium text-base">{idea.title}</span>
                </div>
                {idea.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {idea.description}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        {selected.size} selected
      </p>
    </div>
  );
}
