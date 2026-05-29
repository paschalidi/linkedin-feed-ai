"use client";

import { SelectValue } from "@/components/ui/select";

export function IdeaSelectValue({
  ideas,
  placeholder,
}: {
  ideas: Array<{ id: string; title: string }>;
  placeholder: string;
}) {
  return (
    <SelectValue placeholder={placeholder}>
      {(value: string) =>
        ideas.find((i) => i.id === value)?.title || placeholder
      }
    </SelectValue>
  );
}

export function StyleSelectValue({
  styles,
  placeholder,
}: {
  styles: Array<{ id: string; name: string }>;
  placeholder: string;
}) {
  return (
    <SelectValue placeholder={placeholder}>
      {(value: string) =>
        styles.find((s) => s.id === value)?.name || placeholder
      }
    </SelectValue>
  );
}
