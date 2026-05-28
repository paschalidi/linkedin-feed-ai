"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Newspaper,
  Lightbulb,
  Palette,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sources", label: "Sources", icon: Newspaper },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/styles", label: "Styles", icon: Palette },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 border-r bg-background flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold tracking-tight">LinkedIn Feed AI</h1>
        <p className="text-base text-muted-foreground mt-1">Content Studio</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          // Match exact or child routes (e.g., /posts/123 matches /posts)
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground text-base px-4 py-3 h-auto"
          onClick={async () => {
            const { createClient } = await import("@/lib/supabase/client");
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
        >
          <LogOut className="h-5 w-5 mr-3" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
