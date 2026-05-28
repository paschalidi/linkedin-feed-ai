import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function PostsPage() {
  const posts = await prisma.generatedPost.findMany({
    orderBy: { createdAt: "desc" },
    include: { idea: true },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Generated Posts</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Review, edit, and track your LinkedIn posts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Post History</CardTitle>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
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
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className="flex items-center justify-between rounded-lg border p-5 hover:bg-muted transition-colors"
                >
                  <div className="space-y-1">
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
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
