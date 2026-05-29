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
} from "@/components/ui/select";
import { StyleSelectValue } from "./select-values";
import { IdeaMultiSelect } from "./idea-multi-select";
import { Lightbulb, Palette, Sparkles, AlertCircle } from "lucide-react";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ idea?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ideas = await getIdeasForCompose();
  const activeStyle = await getActiveStyleProfile();
  const allStyles = await getAllStyleProfiles();

  const preselectedIdea = params.idea;
  const error = params.error;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Composer</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Generate a LinkedIn post from one or more ideas and your sources
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:bg-red-950 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Generation Failed
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-line">
                {decodeURIComponent(error)}
              </p>
            </div>
          </div>
        </div>
      )}

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
            let result;
            try {
              result = await composePost(formData);
            } catch (err: any) {
              const message = err?.message || "Failed to compose post";
              redirect(`/compose?error=${encodeURIComponent(message)}`);
            }
            revalidatePath("/posts");
            redirect(`/posts/${result.post.id}`);
          }}
          className="space-y-8"
        >
          <div className="grid gap-8">
            {/* Idea Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Lightbulb className="h-6 w-6" />
                  Select Ideas
                </CardTitle>
                <CardDescription>
                  Pick one or more topics to mix into a single post
                </CardDescription>
              </CardHeader>
              <CardContent>
                <IdeaMultiSelect
                  ideas={ideas}
                  preselected={preselectedIdea}
                />
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
                  <SelectTrigger className="w-full text-base">
                    <StyleSelectValue
                      styles={allStyles}
                      placeholder="Choose a style"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {allStyles.map((style) => (
                      <SelectItem key={style.id} value={style.id}>
                        {style.name}
                        {style.isActive ? " (active)" : ""}
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
