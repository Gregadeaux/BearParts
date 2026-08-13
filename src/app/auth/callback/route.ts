import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** OAuth code exchange — Google redirects here after login. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Behind Fly's proxy, request.url's origin is the internal bind address
  // (0.0.0.0:8080) — reconstruct the public origin from forwarded headers.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const publicOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${publicOrigin}${next}`);
  }
  return NextResponse.redirect(`${publicOrigin}/login?error=auth`);
}
