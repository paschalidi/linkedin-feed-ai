"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureDevUser } from "./dev-login";

const COOLDOWN_SECONDS = 60;
const STORAGE_KEY = "magic_link_last_sent";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [isDevMode, setIsDevMode] = useState(false);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cooldown > 0) {
      setMessage(`Please wait ${cooldown}s before requesting another link.`);
      return;
    }

    if (email.trim().toLowerCase() !== "paschalidi@outlook.com") {
      setMessage("Access denied. This app is private.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        if (error.message.includes("rate limit") || error.status === 429) {
          setMessage("Too many requests. Please wait a minute before trying again.");
        } else {
          throw error;
        }
      } else {
        setMessage("Magic link sent! Check your email (and spam folder).");
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
        setCooldown(COOLDOWN_SECONDS);
      }
    } catch (error: any) {
      setMessage(error.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async () => {
    setLoading(true);
    setMessage("Setting up dev environment...");

    try {
      // Ensure dev user exists (server action with service role key)
      const { email: devEmail, password: devPassword } = await ensureDevUser();

      setMessage("Dev user ready. Signing in...");

      // Sign in with the dev credentials
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
      setMessage(error.message || "Dev login failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">LinkedIn Feed AI</CardTitle>
          <CardDescription className="text-base">Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          {!isDevMode ? (
            <form onSubmit={handleMagicLink} className="space-y-5">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="text-base"
              />
              <Button 
                type="submit" 
                className="w-full text-base" 
                disabled={loading || cooldown > 0}
              >
                {loading 
                  ? "Sending..." 
                  : cooldown > 0 
                    ? `Wait ${cooldown}s` 
                    : "Send Magic Link"
                }
              </Button>
              {message && (
                <p className={`text-base text-center ${
                  message.includes("sent") || message.includes("ready")
                    ? "text-green-600" 
                    : "text-destructive"
                }`}>
                  {message}
                </p>
              )}
              <p className="text-sm text-center text-muted-foreground">
                We&apos;ll email you a magic link to sign in instantly.
                No password needed.
              </p>
              <div className="pt-2 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-sm text-muted-foreground"
                  onClick={() => {
                    setIsDevMode(true);
                    setMessage("");
                  }}
                >
                  Developer Login (skip email)
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="bg-muted rounded-lg p-5 text-base space-y-2">
                <p className="font-medium">Development Mode</p>
                <p className="text-muted-foreground">
                  Skip email verification and log in with a test account.
                  Creates the user automatically if it doesn&apos;t exist.
                </p>
              </div>
              
              <Button 
                onClick={handleDevLogin} 
                className="w-full text-base" 
                disabled={loading}
              >
                {loading ? "Logging in..." : "Dev Login"}
              </Button>

              {message && (
                <p className={`text-base text-center ${
                  message.includes("ready") || message.includes("Signing")
                    ? "text-green-600" 
                    : "text-destructive"
                }`}>
                  {message}
                </p>
              )}

              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm text-muted-foreground"
                onClick={() => {
                  setIsDevMode(false);
                  setMessage("");
                }}
              >
                Back to Magic Link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
