import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPost, updatePost } from "../actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyCheck, CheckCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) {
    notFound();
  }

  const idea = post.daily_ideas;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/posts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Posts
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {idea?.title || "Generated Post"}
          </h1>
          <div className="flex items-center gap-2 mt-2">
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
            <span className="text-sm text-muted-foreground">
              {new Date(post.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Post Editor */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Draft</CardTitle>
            <CardDescription>
              Edit and finalize your LinkedIn post
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={async (formData) => {
                "use server";
                await updatePost(formData);
                revalidatePath(`/posts/${id}`);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="id" value={post.id} />
              <Textarea
                name="final_content"
                defaultValue={post.final_content || post.draft_content}
                rows={20}
                className="font-mono text-sm leading-relaxed"
              />

              <div className="flex gap-3">
                <Button
                  type="submit"
                  name="status"
                  value="approved"
                  variant="default"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>

                <Button
                  type="submit"
                  name="status"
                  value="posted"
                  variant="secondary"
                >
                  <CopyCheck className="h-4 w-4 mr-2" />
                  Mark as Posted
                </Button>

                <CopyButton text={post.final_content || post.draft_content} />
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Meta Info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {idea && (
              <div>
                <p className="text-sm font-medium">Original Idea</p>
                <p className="text-sm text-muted-foreground">
                  {idea.title}
                </p>
                {idea.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {idea.description}
                  </p>
                )}
              </div>
            )}

            <div>
              <p className="text-sm font-medium">Word Count</p>
              <p className="text-sm text-muted-foreground">
                {(post.final_content || post.draft_content).split(/\s+/).length}{" "}
                words
              </p>
            </div>

            <div>
              <p className="text-sm font-medium">Character Count</p>
              <p className="text-sm text-muted-foreground">
                {(post.final_content || post.draft_content).length} characters
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
