import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getURL } from "@/lib/utils/url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const siteUrl = getURL();

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${siteUrl}${next.slice(1)}`);
    }
  }

  return NextResponse.redirect(`${siteUrl}login?error=auth`);
}
