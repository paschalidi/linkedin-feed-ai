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
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Generate and manage your LinkedIn content
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Draft Ideas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{draftCount}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Waiting to be written
            </p>
            <Link href="/ideas">
              <Button className="mt-5 w-full">
                <Plus className="h-5 w-5 mr-2" />
                Add Idea
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingReview}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Posts to review
            </p>
            <Link href="/posts">
              <Button className="mt-5 w-full" variant="secondary">
                <ClipboardList className="h-5 w-5 mr-2" />
                Review
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Ready to Post</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{approvedCount}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Approved posts
            </p>
            <Link href="/compose">
              <Button className="mt-5 w-full" variant="outline">
                <Sparkles className="h-5 w-5 mr-2" />
                Generate
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Recent Ideas</CardTitle>
          </CardHeader>
          <CardContent>
            {(!ideas || ideas.length === 0) ? (
              <p className="text-base text-muted-foreground">
                No ideas yet. Add one to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {ideas.map((idea) => (
                  <Link
                    key={idea.id}
                    href={`/compose?idea=${idea.id}`}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium text-base">{idea.title}</p>
                      {idea.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {idea.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Recent Posts</CardTitle>
          </CardHeader>
          <CardContent>
            {(!posts || posts.length === 0) ? (
              <p className="text-base text-muted-foreground">
                No posts generated yet. Go to Ideas and generate your first post.
              </p>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="text-base line-clamp-2">
                        {post.final_content || post.draft_content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {post.status} · {new Date(post.created_at).toLocaleDateString()}
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
    </div>
  );
}
