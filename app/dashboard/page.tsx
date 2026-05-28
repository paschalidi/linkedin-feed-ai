import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, ClipboardList, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: ideas } = await supabase
    .from("daily_ideas")
    .select("*")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: posts } = await supabase
    .from("generated_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  const draftCount = ideas?.length || 0;
  const pendingReview = posts?.filter((p) => p.status === "draft").length || 0;
  const approvedCount = posts?.filter((p) => p.status === "approved").length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Generate and manage your LinkedIn content
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Draft Ideas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Waiting to be written
            </p>
            <Link href="/ideas">
              <Button className="mt-4 w-full" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Idea
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReview}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Posts to review
            </p>
            <Link href="/posts">
              <Button className="mt-4 w-full" variant="secondary" size="sm">
                <ClipboardList className="h-4 w-4 mr-2" />
                Review
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ready to Post</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Approved posts
            </p>
            <Link href="/compose">
              <Button className="mt-4 w-full" variant="outline" size="sm">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Ideas</CardTitle>
          </CardHeader>
          <CardContent>
            {(!ideas || ideas.length === 0) ? (
              <p className="text-sm text-muted-foreground">
                No ideas yet. Add one to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {ideas.map((idea) => (
                  <Link
                    key={idea.id}
                    href={`/compose?idea=${idea.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium">{idea.title}</p>
                      {idea.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {idea.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Posts</CardTitle>
          </CardHeader>
          <CardContent>
            {(!posts || posts.length === 0) ? (
              <p className="text-sm text-muted-foreground">
                No posts generated yet. Go to Ideas and generate your first post.
              </p>
            ) : (
              <div className="space-y-2">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="text-sm line-clamp-2">
                        {post.final_content || post.draft_content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {post.status} · {new Date(post.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
