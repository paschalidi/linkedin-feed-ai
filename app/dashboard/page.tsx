import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, ClipboardList } from "lucide-react";

export default function DashboardPage() {
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
            <CardTitle className="text-sm font-medium">Today&apos;s Post</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">No draft yet</div>
            <p className="text-xs text-muted-foreground mt-1">
              Generate a post for today
            </p>
            <Button className="mt-4 w-full" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Idea
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Surprise Me</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Auto-generate</div>
            <p className="text-xs text-muted-foreground mt-1">
              AI picks from your sources
            </p>
            <Button className="mt-4 w-full" variant="secondary" size="sm">
              <Sparkles className="h-4 w-4 mr-2" />
              Generate
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 drafts</div>
            <p className="text-xs text-muted-foreground mt-1">
              Posts waiting for approval
            </p>
            <Button className="mt-4 w-full" variant="outline" size="sm">
              <ClipboardList className="h-4 w-4 mr-2" />
              Review
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Posts</CardTitle>
          <CardDescription>Your generated LinkedIn posts</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No posts generated yet. Add sources and ideas to get started.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
