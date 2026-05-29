"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  RefreshCw,
  Trash2,
  Plus,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface LinkedInProfile {
  id: string;
  profileUrl: string;
  displayName: string | null;
  postCount: number | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
}

interface LinkedInProfileListProps {
  profiles: LinkedInProfile[];
  onAdd: (url: string) => Promise<void>;
  onResync: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onGenerateFingerprint: () => Promise<void>;
}

function formatDate(date: Date | null): string {
  if (!date) return "Never";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function extractUsername(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || url;
  } catch {
    return url;
  }
}

export default function LinkedInProfileList({
  profiles,
  onAdd,
  onResync,
  onRemove,
  onGenerateFingerprint,
}: LinkedInProfileListProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();
  const [resyncingId, setResyncingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();

  const totalPosts = profiles.reduce(
    (sum, p) => sum + (p.postCount || 0),
    0
  );

  const handleAdd = () => {
    setError(null);
    setSuccess(null);
    startAdd(async () => {
      try {
        await onAdd(url);
        setUrl("");
        setSuccess("Profile added and posts scraped successfully!");
      } catch (err: any) {
        setError(err?.message || "Failed to add profile");
      }
    });
  };

  const handleResync = async (id: string) => {
    setError(null);
    setResyncingId(id);
    try {
      await onResync(id);
      setSuccess("Profile resynced successfully!");
    } catch (err: any) {
      setError(err?.message || "Failed to resync profile");
    } finally {
      setResyncingId(null);
    }
  };

  const handleRemove = async (id: string) => {
    setError(null);
    setRemovingId(id);
    try {
      await onRemove(id);
      setSuccess("Profile removed.");
    } catch (err: any) {
      setError(err?.message || "Failed to remove profile");
    } finally {
      setRemovingId(null);
    }
  };

  const handleGenerate = () => {
    setError(null);
    setSuccess(null);
    startGenerate(async () => {
      try {
        await onGenerateFingerprint();
        setSuccess("Style fingerprint generated! 'Cloned Voice' is now your active style.");
      } catch (err: any) {
        setError(err?.message || "Failed to generate fingerprint");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Add Profile */}
      <div className="flex gap-2">
        <Input
          placeholder="https://linkedin.com/in/username"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          disabled={adding}
        />
        <Button onClick={handleAdd} disabled={adding || !url.trim()}>
          {adding ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Add
        </Button>
      </div>

      {/* Messages */}
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

      {/* Profile List */}
      {profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No profiles added yet. Paste a LinkedIn profile URL above to start
          cloning their voice.
        </p>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {profile.displayName ||
                      extractUsername(profile.profileUrl)}
                  </span>
                  <a
                    href={profile.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-xs">
                    {profile.postCount || 0} posts
                  </Badge>
                  <span>·</span>
                  <span>Synced {formatDate(profile.lastSyncedAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResync(profile.id)}
                  disabled={resyncingId === profile.id}
                >
                  {resyncingId === profile.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(profile.id)}
                  disabled={removingId === profile.id}
                >
                  {removingId === profile.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate Fingerprint */}
      {profiles.length > 0 && (
        <div className="pt-2 border-t">
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full"
            variant="outline"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {generating
              ? "Analyzing writing style..."
              : `Generate Style Fingerprint (${totalPosts} posts)`}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Claude will analyze {totalPosts} posts across {profiles.length}{" "}
            profiles and create a &quot;Cloned Voice&quot; style profile.
          </p>
        </div>
      )}
    </div>
  );
}
