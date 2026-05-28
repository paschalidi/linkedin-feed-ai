"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const COOLDOWN_SECONDS = 60;
const STORAGE_KEY = "magic_link_last_sent";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Check for existing cooldown on mount
  useEffect(() => {
    const lastSent = localStorage.getItem(STORAGE_KEY);
    if (lastSent) {
      const elapsed = Math.floor((Date.now() - parseInt(lastSent)) / 1000);
      const remaining = Math.max(0, COOLDOWN_SECONDS - elapsed);
      if (remaining > 0) {
        setCooldown(remaining);
      }
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cooldown > 0) {
      setMessage(`Please wait ${cooldown}s before requesting another link.`);
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
  }, [email, cooldown]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">LinkedIn Feed AI</CardTitle>
          <CardDescription>Sign in with your email</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <Button 
              type="submit" 
              className="w-full" 
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
              <p className={`text-sm text-center ${
                message.includes("sent") 
                  ? "text-green-600" 
                  : "text-destructive"
              }`}>
                {message}
              </p>
            )}
            <p className="text-xs text-center text-muted-foreground">
              We&apos;ll email you a magic link to sign in instantly.
              No password needed.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
