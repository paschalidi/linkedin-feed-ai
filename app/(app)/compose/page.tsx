import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getIdeasForCompose,
  getActiveStyleProfile,
  getAllStyleProfiles,
  composePost,
} from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lightbulb, Palette, Sparkles, AlertCircle } from "lucide-react";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ idea?: string }>;
}) {
  const params = await searchParams;
  const ideas = await getIdeasForCompose();
  const activeStyle = await getActiveStyleProfile();
  const allStyles = await getAllStyleProfiles();

  const preselectedIdea = params.idea;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Composer</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Generate a LinkedIn post from an idea and your sources
        </p>
      </div>

      {ideas.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-muted-foreground text-base">
              <AlertCircle className="h-6 w-6" />
              <p>
                No draft ideas available.{" "}
                <a href="/ideas" className="underline">
                  Add an idea first
                </a>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <form
          action={async (formData) => {
            "use server";
            const result = await composePost(formData);
            revalidatePath("/posts");
            redirect(`/posts/${result.post.id}`);
          }}
          className="space-y-8"
        >
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Idea Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Lightbulb className="h-6 w-6" />
                  Select Idea
                </CardTitle>
                <CardDescription>
                  Pick a topic to write about
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  name="idea_id"
                  defaultValue={preselectedIdea || ideas[0]?.id}
                >
                  <SelectTrigger className="text-base">
                    <SelectValue placeholder="Choose an idea" />
                  </SelectTrigger>
                  <SelectContent>
                    {ideas.map((idea) => (
                      <SelectItem key={idea.id} value={idea.id}>
                        <div className="flex flex-col">
                          <span className="text-base">{idea.title}</span>
                          {idea.description && (
                            <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                              {idea.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Style Profile Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Palette className="h-6 w-6" />
                  Writing Style
                </CardTitle>
                <CardDescription>
                  Choose how the post should sound
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  name="style_profile_id"
                  defaultValue={activeStyle?.id || allStyles[0]?.id}
                >
                  <SelectTrigger className="text-base">
                    <SelectValue placeholder="Choose a style" />
                  </SelectTrigger>
                  <SelectContent>
                    {allStyles.map((style) => (
                      <SelectItem key={style.id} value={style.id}>
                        <div className="flex items-center gap-2 text-base">
                          {style.name}
                          {style.isActive && (
                            <span className="text-sm text-muted-foreground">
                              (active)
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button type="submit" size="lg" className="w-full max-w-md text-lg">
              <Sparkles className="h-6 w-6 mr-2" />
              Generate LinkedIn Post
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
