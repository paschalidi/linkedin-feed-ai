import { revalidatePath } from "next/cache";
import {
  addStyleProfile,
  deleteStyleProfile,
  getStyleProfiles,
  setActiveProfile,
} from "./actions";
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
import { Palette, Trash2, Star, Plus } from "lucide-react";

export default async function StylesPage() {
  const profiles = await getStyleProfiles();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Style Profiles</h1>
        <p className="text-muted-foreground mt-1">
          Define how the AI should write your LinkedIn posts
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Add Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create Style Profile</CardTitle>
            <CardDescription>
              Describe your voice and tone in natural language
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={async (formData) => {
                "use server";
                await addStyleProfile(formData);
                revalidatePath("/styles");
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">Profile Name</label>
                <Input name="name" placeholder="e.g., My Professional Voice" required />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Style Description</label>
                <Textarea
                  name="prompt_text"
                  placeholder="Short paragraphs, confident tone, 3-5 bullet points per post, emojis only when demonstrating, always end with a question to drive engagement..."
                  rows={6}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_active"
                  id="is_active"
                  className="rounded border-gray-300"
                />
                <label htmlFor="is_active" className="text-sm font-medium">
                  Set as active profile
                </label>
              </div>

              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Create Profile
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Profiles List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Profiles</CardTitle>
            <CardDescription>
              {profiles.length} profile{profiles.length !== 1 ? "s" : ""} saved
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No style profiles yet. Create one to guide the AI&apos;s writing.
              </p>
            ) : (
              <div className="space-y-3">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="rounded-lg border p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{profile.name}</span>
                        {profile.is_active && (
                          <Badge variant="default">
                            <Star className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {!profile.is_active && (
                          <form
                            action={async () => {
                              "use server";
                              await setActiveProfile(profile.id);
                              revalidatePath("/styles");
                            }}
                          >
                            <Button variant="ghost" size="sm" type="submit">
                              <Star className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </form>
                        )}
                        <form
                          action={async () => {
                            "use server";
                            await deleteStyleProfile(profile.id);
                            revalidatePath("/styles");
                          }}
                        >
                          <Button variant="ghost" size="icon" type="submit">
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </form>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {profile.prompt_text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
