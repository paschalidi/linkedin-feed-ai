"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb,
  Archive,
  RotateCcw,
  Loader2,
  Wand2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface Idea {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: Date;
}

interface StyleProfile {
  id: string;
  name: string;
  isActive: boolean;
}

interface IdeaListProps {
  draftIdeas: Idea[];
  usedIdeas: Idea[];
  archivedIdeas: Idea[];
  styles: StyleProfile[];
  onArchive: (id: string) => Promise<void>;
  onReuse: (id: string) => Promise<void>;
  onGenerate: (ideaId: string, styleProfileId: string) => Promise<{ success: boolean; postId?: string; error?: string }>;
  onSurpriseMe?: () => Promise<{ success: boolean; error?: string }>;
}

export default function IdeaList({
  draftIdeas,
  usedIdeas,
  archivedIdeas,
  styles,
  onArchive,
  onReuse,
  onGenerate,
  onSurpriseMe,
}: IdeaListProps) {
  const router = useRouter();
  const [selectedStyleId, setSelectedStyleId] = useState(
    styles.find((s) => s.isActive)?.id || styles[0]?.id || ""
  );
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [surprising, setSurprising] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = (ideaId: string) => {
    if (!selectedStyleId) {
      setError("Select a style profile first");
      return;
    }
    setError(null);
    setSuccess(null);
    setGeneratingId(ideaId);
    startTransition(async () => {
      const result = await onGenerate(ideaId, selectedStyleId);
      setGeneratingId(null);
      if (result.success && result.postId) {
        router.push(`/posts/${result.postId}`);
      } else {
        setError(result.error || "Failed to generate post");
      }
    });
  };

  const activeStyleName = styles.find((s) => s.id === selectedStyleId)?.name || "None";

  const handleSurpriseMe = () => {
    if (!onSurpriseMe) return;
    setError(null);
    setSuccess(null);
    setSurprising(true);
    startTransition(async () => {
      const result = await onSurpriseMe();
      setSurprising(false);
      if (result.success) {
        setSuccess("New idea generated!");
        router.refresh();
      } else {
        setError(result.error || "Failed to generate idea");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Style Selector + Surprise Me + Messages */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium shrink-0">Voice:</label>
          <select
            value={selectedStyleId}
            onChange={(e) => {
              setSelectedStyleId(e.target.value);
              setError(null);
            }}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {styles.map((style) => (
              <option key={style.id} value={style.id}>
                {style.name} {style.isActive ? "(active)" : ""}
              </option>
            ))}
          </select>
          {onSurpriseMe && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSurpriseMe}
              disabled={surprising || isPending}
            >
              {surprising ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Surprise Me
            </Button>
          )}
        </div>
        
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {success}
          </div>
        )}
      </div>

      {/* Draft Ideas */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">
          Draft Ideas
          {draftIdeas.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {draftIdeas.length}
            </Badge>
          )}
        </h3>
        {draftIdeas.length === 0 ? (
          <p className="text-base text-muted-foreground">
            No pending ideas. Add one above.
          </p>
        ) : (
          <div className="space-y-3">
            {draftIdeas.map((idea) => (
              <div
                key={idea.id}
                className="flex items-start justify-between rounded-lg border p-4 gap-4"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500 shrink-0" />
                    <span className="font-medium text-base">{idea.title}</span>
                  </div>
                  {idea.description && (
                    <p className="text-sm text-muted-foreground">
                      {idea.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(idea.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleGenerate(idea.id)}
                    disabled={generatingId === idea.id || isPending}
                  >
                    {generatingId === idea.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-1" />
                    )}
                    Generate
                  </Button>
                  <form
                    action={async () => {
                      await onArchive(idea.id);
                    }}
                  >
                    <Button variant="ghost" size="icon" type="submit">
                      <Archive className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Used Ideas */}
      {usedIdeas.length > 0 && (
        <div className="space-y-3 pt-4 border-t">
          <h3 className="text-lg font-semibold">
            Used Ideas
            <Badge variant="secondary" className="ml-2">
              {usedIdeas.length}
            </Badge>
          </h3>
          <div className="space-y-3">
            {usedIdeas.map((idea) => (
              <div
                key={idea.id}
                className="flex items-start justify-between rounded-lg border p-4 gap-4"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-blue-500 shrink-0" />
                    <span className="font-medium text-base">{idea.title}</span>
                    <Badge variant="secondary">Used</Badge>
                  </div>
                  {idea.description && (
                    <p className="text-sm text-muted-foreground">
                      {idea.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <form
                    action={async () => {
                      await onReuse(idea.id);
                    }}
                  >
                    <Button variant="outline" size="sm" type="submit">
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reuse
                    </Button>
                  </form>
                  <form
                    action={async () => {
                      await onArchive(idea.id);
                    }}
                  >
                    <Button variant="ghost" size="icon" type="submit">
                      <Archive className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archived Ideas */}
      {archivedIdeas.length > 0 && (
        <div className="space-y-3 pt-4 border-t">
          <h3 className="text-lg font-semibold">
            Archived Ideas
            <Badge variant="secondary" className="ml-2">
              {archivedIdeas.length}
            </Badge>
          </h3>
          <div className="space-y-3">
            {archivedIdeas.map((idea) => (
              <div
                key={idea.id}
                className="flex items-start justify-between rounded-lg border p-4 gap-4"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Archive className="h-5 w-5 text-muted-foreground shrink-0" />
                    <span className="font-medium text-base line-through text-muted-foreground">
                      {idea.title}
                    </span>
                    <Badge variant="outline">Archived</Badge>
                  </div>
                  {idea.description && (
                    <p className="text-sm text-muted-foreground">
                      {idea.description}
                    </p>
                  )}
                </div>
                <form
                  action={async () => {
                    await onReuse(idea.id);
                  }}
                >
                  <Button variant="outline" size="sm" type="submit">
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Restore
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
