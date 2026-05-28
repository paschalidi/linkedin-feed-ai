import { revalidatePath } from "next/cache";
import { addIdea, archiveIdea, getIdeas } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Plus, Archive, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function IdeasPage() {
  const ideas = await getIdeas();
  const draftIdeas = ideas.filter((i) => i.status === "draft");
  const archivedIdeas = ideas.filter((i) => i.status === "archived");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Ideas</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Queue of topics to write about today
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        {/* Add Idea Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-xl">Add Today&apos;s Idea</CardTitle>
            <CardDescription>
              What do you want to write about?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={async (formData) => {
                "use server";
                await addIdea(formData);
                revalidatePath("/ideas");
              }}
              className="space-y-5"
            >
              <div className="space-y-2">
                <label className="text-base font-medium">Topic / Title</label>
                <Input
                  name="title"
                  placeholder="e.g., AI in Recruiting"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-base font-medium">Description (optional)</label>
                <Textarea
                  name="description"
                  placeholder="Key points to cover, angle, or perspective..."
                  rows={5}
                />
              </div>

              <Button type="submit" className="w-full text-base">
                <Plus className="h-5 w-5 mr-2" />
                Add Idea
              </Button>
            </form>

            <div className="mt-5 pt-5 border-t">
              <Link href="/compose">
                <Button variant="secondary" className="w-full text-base">
                  <Sparkles className="h-5 w-5 mr-2" />
                  Surprise Me
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Draft Ideas */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl">Pending Ideas</CardTitle>
            <CardDescription>
              {draftIdeas.length} idea{draftIdeas.length !== 1 ? "s" : ""} waiting
            </CardDescription>
          </CardHeader>
          <CardContent>
            {draftIdeas.length === 0 ? (
              <p className="text-base text-muted-foreground">
                No pending ideas. Add one above or hit &quot;Surprise Me&quot; to auto-generate.
              </p>
            ) : (
              <div className="space-y-4">
                {draftIdeas.map((idea) => (
                  <div
                    key={idea.id}
                    className="flex items-start justify-between rounded-lg border p-5"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                        <span className="font-medium text-base">{idea.title}</span>
                        <Badge variant="outline">Draft</Badge>
                      </div>
                      {idea.description && (
                        <p className="text-base text-muted-foreground">
                          {idea.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(idea.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/compose?idea=${idea.id}`}>
                        <Button variant="default" size="sm" className="text-base">
                          Generate
                          <ArrowRight className="h-5 w-5 ml-1" />
                        </Button>
                      </Link>
                      <form
                        action={async () => {
                          "use server";
                          await archiveIdea(idea.id);
                          revalidatePath("/ideas");
                        }}
                      >
                        <Button variant="ghost" size="icon" type="submit">
                          <Archive className="h-5 w-5 text-muted-foreground" />
                        </Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Archived Ideas */}
      {archivedIdeas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Archived</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {archivedIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className="flex items-center gap-2 text-base text-muted-foreground"
                >
                  <Archive className="h-4 w-4" />
                  <span className="line-through">{idea.title}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
