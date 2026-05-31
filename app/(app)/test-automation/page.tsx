"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { testRssSync, testGenerateIdea, testPublishQueue } from "./actions";

export default function TestAutomationPage() {
  const [rssResult, setRssResult] = useState<string>("");
  const [ideaResult, setIdeaResult] = useState<string>("");
  const [queueResult, setQueueResult] = useState<string>("");

  const runRss = async () => {
    setRssResult("Running...");
    const res = await testRssSync();
    setRssResult(JSON.stringify(res, null, 2));
  };

  const runIdea = async () => {
    setIdeaResult("Running...");
    const res = await testGenerateIdea();
    setIdeaResult(JSON.stringify(res, null, 2));
  };

  const runQueue = async () => {
    setQueueResult("Running...");
    const res = await testPublishQueue();
    setQueueResult(JSON.stringify(res, null, 2));
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Test Automation</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Manually trigger cron jobs to verify they work before deploying
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RSS Sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Fetches all RSS feeds, extracts articles, generates embeddings.
            Same as the 2-day cron.
          </p>
          <Button onClick={runRss}>Run RSS Sync</Button>
          {rssResult && (
            <pre className="bg-muted p-3 rounded-md text-sm overflow-auto">
              {rssResult}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generate Idea</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Picks 5 recent articles, calls Gemini to generate a new idea.
            Same as the daily cron.
          </p>
          <Button onClick={runIdea}>Run Idea Generation</Button>
          {ideaResult && (
            <pre className="bg-muted p-3 rounded-md text-sm overflow-auto">
              {ideaResult}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publish Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Processes the oldest pending queue item (respects daily limit).
            Same as the hourly cron.
          </p>
          <Button onClick={runQueue}>Run Publish Queue</Button>
          {queueResult && (
            <pre className="bg-muted p-3 rounded-md text-sm overflow-auto">
              {queueResult}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
