"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureDevUser } from "./dev-login";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleDevLogin = async () => {
    setLoading(true);
    setMessage("Signing in...");

    try {
      const { email: devEmail, password: devPassword } = await ensureDevUser();

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: devEmail,
        password: devPassword,
      });

      if (error) {
        throw new Error(`Sign in failed: ${error.message}`);
      }

      if (data.session) {
        window.location.href = "/dashboard";
      }
    } catch (error: any) {
      setMessage(error.message || "Login failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">LinkedIn Feed AI</CardTitle>
          <CardDescription className="text-base">Private app — authorized access only</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="bg-muted rounded-lg p-5 text-base space-y-2">
            <p className="font-medium">Welcome back</p>
            <p className="text-muted-foreground">
              Click below to sign in. This app is restricted to the owner only.
            </p>
          </div>

          <Button
            onClick={handleDevLogin}
            className="w-full text-base"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>

          {message && (
            <p
              className={`text-base text-center ${
                message.includes("failed") || message.includes("error")
                  ? "text-destructive"
                  : "text-green-600"
              }`}
            >
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
