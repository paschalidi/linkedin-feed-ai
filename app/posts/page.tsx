import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowRight, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function PostsPage() {
  const supabase = await createClient();

  let posts: any[] = [];
  let dbError: string | null = null;

  try {
    const { data: postsData, error } = await supabase
      .from("generated_posts")
      .select("*, daily_ideas(title)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Posts error:", error.message);
      dbError = "Database tables not found. Run supabase/setup.sql.";
    } else {
      posts = postsData || [];
    }
  } catch (err: any) {
    console.error("Posts exception:", err);
    dbError = "Database connection issue.";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Generated Posts</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Review, edit, and track your LinkedIn posts
        </p>
      </div>

      {dbError && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:bg-yellow-950 dark:border-yellow-800">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Database Setup Required
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                {dbError}
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Post History</CardTitle>
        </CardHeader>
        <CardContent>
          {(!posts || posts.length === 0) ? (
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
              {posts.map((post: any) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className="flex items-center justify-between rounded-lg border p-5 hover:bg-muted transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-base">
                        {post.daily_ideas?.title || "Untitled Post"}
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
                      {post.final_content || post.draft_content}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(post.created_at).toLocaleDateString()}
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
