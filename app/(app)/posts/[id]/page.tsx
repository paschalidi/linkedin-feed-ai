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

  const idea = post.idea;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/posts">
          <Button variant="ghost" size="default">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Posts
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
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
            <span className="text-base text-muted-foreground">
              {new Date(post.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Post Editor */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl">Draft</CardTitle>
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
              className="space-y-5"
            >
              <input type="hidden" name="id" value={post.id} />
              <Textarea
                name="final_content"
                defaultValue={post.finalContent || post.draftContent}
                rows={20}
                className="font-mono text-base leading-relaxed"
              />

              <div className="flex gap-4">
                <Button
                  type="submit"
                  name="status"
                  value="approved"
                  variant="default"
                  className="text-base"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Approve
                </Button>

                <Button
                  type="submit"
                  name="status"
                  value="posted"
                  variant="secondary"
                  className="text-base"
                >
                  <CopyCheck className="h-5 w-5 mr-2" />
                  Mark as Posted
                </Button>

                <CopyButton text={post.finalContent || post.draftContent} />
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Meta Info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-xl">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {idea && (
              <div>
                <p className="text-base font-medium">Original Idea</p>
                <p className="text-base text-muted-foreground">
                  {idea.title}
                </p>
                {idea.description && (
                  <p className="text-base text-muted-foreground mt-1">
                    {idea.description}
                  </p>
                )}
              </div>
            )}

            <div>
              <p className="text-base font-medium">Word Count</p>
              <p className="text-base text-muted-foreground">
                {(post.finalContent || post.draftContent).split(/\s+/).length}{" "}
                words
              </p>
            </div>

            <div>
              <p className="text-base font-medium">Character Count</p>
              <p className="text-base text-muted-foreground">
                {(post.finalContent || post.draftContent).length} characters
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
