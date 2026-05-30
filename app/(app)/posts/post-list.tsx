"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, Archive, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface Post {
  id: string;
  status: string;
  finalContent: string | null;
  draftContent: string;
  createdAt: Date;
  idea: { title: string } | null;
}

interface PostListProps {
  posts: Post[];
  onArchive: (id: string) => Promise<void>;
}

export default function PostList({ posts, onArchive }: PostListProps) {
  const router = useRouter();
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleArchive = (id: string) => {
    setError(null);
    setSuccess(null);
    setArchivingId(id);
    startTransition(async () => {
      try {
        await onArchive(id);
        setSuccess("Post archived");
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Failed to archive post");
      } finally {
        setArchivingId(null);
      }
    });
  };

  if (posts.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-base text-muted-foreground">
          No posts generated yet.
        </p>
        <p className="text-base text-muted-foreground mt-1">
          Go to{" "}
          <Link href="/ideas" className="underline">
            Ideas
          </Link>{" "}
          and generate your first post.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
      {posts.map((post) => (
        <div
          key={post.id}
          className="flex items-start justify-between rounded-lg border p-5 gap-4 hover:bg-muted transition-colors group"
        >
          <Link
            href={`/posts/${post.id}`}
            className="flex-1 min-w-0 space-y-1"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-base">
                {post.idea?.title || "Untitled Post"}
              </span>
              <Badge
                variant={
                  post.status === "approved"
                    ? "default"
                    : post.status === "posted"
                    ? "secondary"
                    : "outline"
                }
              >
                {post.status}
              </Badge>
            </div>
            <p className="text-base text-muted-foreground line-clamp-2 max-w-lg">
              {post.finalContent || post.draftContent}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(post.createdAt).toLocaleDateString()}
            </p>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/posts/${post.id}`}>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleArchive(post.id)}
              disabled={archivingId === post.id || isPending}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {archivingId === post.id ? (
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              ) : (
                <Archive className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
