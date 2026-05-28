import { revalidatePath } from "next/cache";
import { addSource, deleteSource, getSources } from "./actions";
import { ingestArticle, getAllArticles } from "./ingest-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, Trash2, Rss, Link2, Download } from "lucide-react";

export default async function SourcesPage() {
  const sources = await getSources();
  const articles = await getAllArticles();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sources</h1>
        <p className="text-muted-foreground mt-1">
          Manage newsletter feeds and LinkedIn profiles
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Add Source Form */}
        <Card>
          <CardHeader>
            <CardTitle>Add Newsletter Source</CardTitle>
            <CardDescription>
              Paste a URL or add an RSS feed to ingest articles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={async (formData) => {
                "use server";
                await addSource(formData);
                revalidatePath("/sources");
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input name="name" placeholder="e.g., TLDR AI Newsletter" required />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select name="type" defaultValue="manual">
                  <SelectTrigger>
                    <SelectValue placeholder="Select source type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Single Article URL
                      </div>
                    </SelectItem>
                    <SelectItem value="rss">
                      <div className="flex items-center gap-2">
                        <Rss className="h-4 w-4" />
                        RSS Feed
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">URL</label>
                <Input
                  name="url"
                  type="url"
                  placeholder="https://example.com/article or feed.xml"
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                <Newspaper className="h-4 w-4 mr-2" />
                Add Source
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sources List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Sources</CardTitle>
            <CardDescription>
              {sources.length} source{sources.length !== 1 ? "s" : ""} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sources yet. Add one to start ingesting articles.
              </p>
            ) : (
              <div className="space-y-3">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{source.name}</span>
                          <Badge variant="secondary">
                            {source.type === "rss" ? (
                              <span className="flex items-center gap-1">
                                <Rss className="h-3 w-3" /> RSS
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Link2 className="h-3 w-3" /> Manual
                              </span>
                            )}
                          </Badge>
                        </div>
                        {source.url && (
                          <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                            {source.url}
                          </p>
                        )}
                        {source.last_fetched_at && (
                          <p className="text-xs text-muted-foreground">
                            Last fetched: {new Date(source.last_fetched_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {source.type === "manual" && source.url && (
                          <form
                            action={async () => {
                              "use server";
                              await ingestArticle(source.id, source.url!);
                              revalidatePath("/sources");
                            }}
                          >
                            <Button variant="ghost" size="sm" type="submit">
                              <Download className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </form>
                        )}
                        <form
                          action={async () => {
                            "use server";
                            await deleteSource(source.id);
                            revalidatePath("/sources");
                          }}
                        >
                          <Button variant="ghost" size="icon" type="submit">
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </form>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Articles Section */}
      <Card>
        <CardHeader>
          <CardTitle>Ingested Articles</CardTitle>
          <CardDescription>
            {articles.length} article{articles.length !== 1 ? "s" : ""} stored in your vector DB
          </CardDescription>
        </CardHeader>
        <CardContent>
          {articles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No articles ingested yet. Add a source and hit the download button to extract content.
            </p>
          ) : (
            <div className="space-y-3">
              {articles.map((article) => (
                <div key={article.id} className="rounded-lg border p-3 space-y-1">
                  <p className="font-medium">{article.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {article.url}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {article.content.length} characters ·{" "}
                    {new Date(article.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
