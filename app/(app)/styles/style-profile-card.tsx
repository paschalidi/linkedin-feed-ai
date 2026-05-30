"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2, Pencil, Check, X, ChevronDown, ChevronUp } from "lucide-react";

interface StyleProfile {
  id: string;
  name: string;
  promptText: string;
  isActive: boolean;
}

interface StyleProfileCardProps {
  profile: StyleProfile;
  onSetActive: () => Promise<void>;
  onDelete: () => Promise<void>;
  onUpdate: (name: string, promptText: string) => Promise<void>;
}

const TRUNCATE_AT = 200;

function getTruncatedText(text: string, expanded: boolean): string {
  if (expanded || text.length <= TRUNCATE_AT) return text;
  // Try to break at a word boundary
  const slice = text.slice(0, TRUNCATE_AT);
  const lastSpace = slice.lastIndexOf(" ");
  const lastNewline = slice.lastIndexOf("\n");
  const breakAt = Math.max(lastSpace, lastNewline);
  if (breakAt > TRUNCATE_AT * 0.5) {
    return slice.slice(0, breakAt) + "...";
  }
  return slice + "...";
}

export default function StyleProfileCard({
  profile,
  onSetActive,
  onDelete,
  onUpdate,
}: StyleProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editPrompt, setEditPrompt] = useState(profile.promptText);
  const [isSaving, setIsSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const textRows = useMemo(
    () => Math.max(10, editPrompt.split("\n").length + 2),
    [editPrompt]
  );

  const isTruncated = profile.promptText.length > TRUNCATE_AT;
  const displayText = getTruncatedText(profile.promptText, expanded);
  const charCount = profile.promptText.length;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(editName, editPrompt);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(profile.name);
    setEditPrompt(profile.promptText);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="rounded-lg border p-5 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Profile Name</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Style Description</label>
          <Textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            rows={textRows}
            className="text-sm font-mono"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <span className="animate-spin mr-1">⟳</span>
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-base">{profile.name}</span>
          {profile.isActive && (
            <Badge variant="default">
              <Star className="h-4 w-4 mr-1" /> Active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!profile.isActive && (
            <form
              action={async () => {
                await onSetActive();
              }}
            >
              <Button variant="ghost" size="sm" type="submit">
                <Star className="h-5 w-5 text-muted-foreground" />
              </Button>
            </form>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-5 w-5 text-muted-foreground" />
          </Button>
          <form
            action={async () => {
              await onDelete();
            }}
          >
            <Button variant="ghost" size="icon" type="submit">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
            </Button>
          </form>
        </div>
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {displayText}
      </p>
      {isTruncated && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" /> Show more
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            {charCount.toLocaleString()} chars
          </span>
        </div>
      )}
      {!isTruncated && (
        <p className="text-xs text-muted-foreground pt-1">
          {charCount.toLocaleString()} chars
        </p>
      )}
    </div>
  );
}
