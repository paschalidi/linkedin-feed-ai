import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function PostsPage() {
  const supabase = await createClient();
  const { data: posts, error } = await supabase
    .from("generated_posts")
    .select("*, daily_ideas(title)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Generated Posts</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Review, edit, and track your LinkedIn posts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Post History</CardTitle>
          <CardDescription>
            {posts?.length || 0} post{posts?.length !== 1 ? "s" : ""} generated
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!posts || posts.length === 0) ? (
            <div className="text-center py-10">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-5" />
              <p className="text-muted-foreground text-lg">
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
            <div className="space-y-4">
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
