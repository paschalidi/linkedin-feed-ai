"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInWithDevPassword } from "./dev-login";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const { email, password: devPassword } = await signInWithDevPassword(password);

      // Sign in with Supabase client
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: devPassword,
      });

      if (error) {
        throw new Error(`Sign in failed: ${error.message}`);
      }

      if (data.session) {
        window.location.href = "/dashboard";
      }
    } catch (error: any) {
      console.error("Login error:", error);
      setMessage(error.message || "Login failed.");
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
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value="paschalidi@outlook.com"
                disabled
                className="text-base bg-muted"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="text-base"
              />
            </div>

            <Button
              type="submit"
              className="w-full text-base"
              disabled={loading || !password}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            {message && (
              <p
                className={`text-base text-center ${
                  message.includes("failed") ||
                  message.includes("Invalid") ||
                  message.includes("not set")
                    ? "text-destructive"
                    : "text-green-600"
                }`}
              >
                {message}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
