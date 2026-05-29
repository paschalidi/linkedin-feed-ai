"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Palette, Sparkles, FileText, ArrowLeft } from "lucide-react";
import { IdeaMultiSelect } from "./idea-multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { StyleSelectValue } from "./select-values";

interface Idea {
  id: string;
  title: string;
  description?: string | null;
}

interface Style {
  id: string;
  name: string;
  isActive: boolean;
}

interface Article {
  id: string;
  title: string;
  url: string;
  similarity?: number;
}

export default function ComposeForm({
  ideas,
  styles,
  activeStyleId,
  preselectedIdea,
  previewAction,
  generateAction,
}: {
  ideas: Idea[];
  styles: Style[];
  activeStyleId: string;
  preselectedIdea?: string;
  previewAction: (formData: FormData) => Promise<Article[]>;
  generateAction: (formData: FormData) => Promise<void>;
}) {
  const [step, setStep] = useState<"select" | "preview">("select");
  const [foundArticles, setFoundArticles] = useState<Article[]>([]);
  const [previewFormData, setPreviewFormData] = useState<FormData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handlePreview(formData: FormData) {
    setIsLoading(true);
    try {
      const articles = await previewAction(formData);
      setFoundArticles(articles);
      setPreviewFormData(formData);
      setStep("preview");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerate(formData: FormData) {
    setIsLoading(true);
    try {
      await generateAction(formData);
    } finally {
      setIsLoading(false);
    }
  }

  if (step === "preview" && previewFormData) {
    return (
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileText className="h-6 w-6" />
              Sources Found
            </CardTitle>
            <CardDescription>
              These articles from your vector DB informed the search. Review them
              before generating.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {foundArticles.length === 0 ? (
              <p className="text-muted-foreground">
                No relevant articles found in your database. Try adding more
                sources on the{" "}
                <a href="/sources" className="underline">
                  Sources page
                </a>
                .
              </p>
            ) : (
              <div className="space-y-3">
                {foundArticles.map((article) => (
                  <div
                    key={article.id}
                    className="rounded-lg border p-4 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-base">
                        {article.title}
                      </span>
                      {typeof article.similarity === "number" && (
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(article.similarity * 100)}% match
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {article.url}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setStep("select")}
                className="text-base"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Back
              </Button>

              <form
                action={async (formData) => {
                  // Copy the original selections into this form
                  if (previewFormData) {
                    for (const [key, value] of previewFormData.entries()) {
                      if (!formData.has(key)) {
                        if (Array.isArray(value)) {
                          for (const v of value) formData.append(key, v);
                        } else {
                          formData.append(key, value as string);
                        }
                      }
                    }
                  }
                  await handleGenerate(formData);
                }}
                className="flex-1"
              >
                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-lg"
                  disabled={isLoading}
                >
                  <Sparkles className="h-6 w-6 mr-2" />
                  {isLoading ? "Generating..." : "Generate LinkedIn Post"}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        await handlePreview(formData);
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
            <IdeaMultiSelect ideas={ideas} preselected={preselectedIdea} />
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
              defaultValue={activeStyleId}
            >
              <SelectTrigger className="w-full text-base">
                <StyleSelectValue
                  styles={styles}
                  placeholder="Choose a style"
                />
              </SelectTrigger>
              <SelectContent>
                {styles.map((style) => (
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
        <Button
          type="submit"
          size="lg"
          className="w-full max-w-md text-lg"
          disabled={isLoading}
        >
          <Sparkles className="h-6 w-6 mr-2" />
          {isLoading ? "Finding sources..." : "Find Relevant Sources"}
        </Button>
      </div>
    </form>
  );
}
