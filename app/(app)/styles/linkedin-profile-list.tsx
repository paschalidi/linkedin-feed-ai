"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Download,
} from "lucide-react";

interface LinkedInProfile {
  id: string;
  profileUrl: string;
  displayName: string | null;
  postCount: number | null;
  lastSyncedAt: Date | null;
  apifyRunId: string | null;
  createdAt: Date;
}

interface LinkedInProfileListProps {
  profiles: LinkedInProfile[];
  onAdd: (url: string) => Promise<void>;
  onStartScrape: (id: string) => Promise<void>;
  onResync: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onGenerateFingerprint: () => Promise<void>;
  onCheckStatus: (
    id: string
  ) => Promise<
    | { status: "idle" }
    | { status: "running"; message: string }
    | { status: "failed"; message: string }
    | { status: "succeeded"; postCount: number; displayName: string | null }
  >;
  onFetchFromDatasetUrl: (id: string, url: string) => Promise<void>;
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
  onStartScrape,
  onResync,
  onRemove,
  onGenerateFingerprint,
  onCheckStatus,
  onFetchFromDatasetUrl,
}: LinkedInProfileListProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();
  const [startingScrapeId, setStartingScrapeId] = useState<string | null>(null);
  const [resyncingId, setResyncingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();

  // Dataset URL inputs per profile
  const [datasetUrls, setDatasetUrls] = useState<Record<string, string>>({});
  const [fetchingId, setFetchingId] = useState<string | null>(null);

  // Track which profiles are currently scraping (by runId)
  const [scrapingIds, setScrapingIds] = useState<Set<string>>(() => {
    return new Set(
      profiles.filter((p) => p.apifyRunId).map((p) => p.id)
    );
  });

  // Keep scrapingIds in sync when profiles prop changes
  useEffect(() => {
    const pending = new Set(
      profiles.filter((p) => p.apifyRunId).map((p) => p.id)
    );
    setScrapingIds(pending);
  }, [profiles]);

  const totalPosts = profiles.reduce(
    (sum, p) => sum + (p.postCount || 0),
    0
  );

  // Poll for pending scrapes every 5 seconds
  const pollPending = useCallback(async () => {
    if (scrapingIds.size === 0) return;

    const idsToCheck = Array.from(scrapingIds);
    let anyCompleted = false;

    for (const id of idsToCheck) {
      try {
        const result = await onCheckStatus(id);

        if (result.status === "succeeded") {
          setScrapingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          setSuccess(
            `Scraped ${result.postCount} posts from ${result.displayName || "profile"}!`
          );
          anyCompleted = true;
        } else if (result.status === "failed") {
          setScrapingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          setError(result.message);
        }
        // "running" — keep polling
      } catch (err: any) {
        console.error("Poll error:", err);
      }
    }

    if (anyCompleted) {
      router.refresh();
    }
  }, [scrapingIds, onCheckStatus, router]);

  useEffect(() => {
    if (scrapingIds.size === 0) return;

    const interval = setInterval(pollPending, 5000);
    // Also check immediately
    pollPending();

    return () => clearInterval(interval);
  }, [scrapingIds, pollPending]);

  const handleAdd = () => {
    setError(null);
    setSuccess(null);
    startAdd(async () => {
      try {
        await onAdd(url);
        setUrl("");
        setSuccess(
          "Profile added! Click 'Fetch Posts' to start scraping."
        );
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Failed to add profile");
      }
    });
  };

  const handleStartScrape = async (id: string) => {
    setError(null);
    setStartingScrapeId(id);
    try {
      await onStartScrape(id);
      setSuccess(
        "Scrape started! It can take 1–3 minutes. Paste the dataset URL below if webhooks are not configured."
      );
      setScrapingIds((prev) => new Set(prev).add(id));
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to start scrape");
    } finally {
      setStartingScrapeId(null);
    }
  };

  const handleResync = async (id: string) => {
    setError(null);
    setResyncingId(id);
    try {
      await onResync(id);
      setSuccess("Resync started! Checking for new posts...");
      setScrapingIds((prev) => new Set(prev).add(id));
      router.refresh();
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
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to remove profile");
    } finally {
      setRemovingId(null);
    }
  };

  const handleFetchDataset = async (id: string) => {
    const datasetUrl = datasetUrls[id];
    if (!datasetUrl?.trim()) return;

    setError(null);
    setFetchingId(id);
    try {
      await onFetchFromDatasetUrl(id, datasetUrl.trim());
      setDatasetUrls((prev) => ({ ...prev, [id]: "" }));
      setSuccess("Posts fetched from dataset URL!");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to fetch dataset");
    } finally {
      setFetchingId(null);
    }
  };

  const handleGenerate = () => {
    setError(null);
    setSuccess(null);
    startGenerate(async () => {
      try {
        await onGenerateFingerprint();
        setSuccess(
          "Style fingerprint generated! 'Cloned Voice' is now your active style."
        );
        router.refresh();
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
        <div className="space-y-4">
          {profiles.map((profile) => {
            const isScraping = scrapingIds.has(profile.id);
            const isPending = !!profile.apifyRunId && (profile.postCount || 0) === 0;
            return (
              <div
                key={profile.id}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
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
                      {isScraping && (
                        <Badge
                          variant="outline"
                          className="text-xs text-amber-600 border-amber-200 bg-amber-50"
                        >
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Scraping...
                        </Badge>
                      )}
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
                    {/* Fetch Posts — shown when no posts and not scraping */}
                    {(profile.postCount || 0) === 0 && !isScraping && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartScrape(profile.id)}
                        disabled={startingScrapeId === profile.id}
                      >
                        {startingScrapeId === profile.id ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-1" />
                        )}
                        Fetch Posts
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResync(profile.id)}
                      disabled={isScraping || resyncingId === profile.id}
                    >
                      {isScraping || resyncingId === profile.id ? (
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

                {/* Manual dataset fetch — always available */}
                <div className="pt-2 border-t">
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://api.apify.com/v2/datasets/XXXX/items?token=..."
                      value={datasetUrls[profile.id] || ""}
                      onChange={(e) =>
                        setDatasetUrls((prev) => ({
                          ...prev,
                          [profile.id]: e.target.value,
                        }))
                      }
                      className="text-xs"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleFetchDataset(profile.id)}
                      disabled={
                        fetchingId === profile.id ||
                        !datasetUrls[profile.id]?.trim()
                      }
                    >
                      {fetchingId === profile.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste an Apify dataset URL to import posts directly.
                  </p>
                </div>
              </div>
            );
          })}
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
            Gemini will analyze {totalPosts} posts across {profiles.length}{" "}
            profiles and create a &quot;Cloned Voice&quot; style profile.
          </p>
        </div>
      )}
    </div>
  );
}
