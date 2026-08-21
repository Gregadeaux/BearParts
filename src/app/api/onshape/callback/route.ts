import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicOrigin } from "@/lib/public-origin";
import { exchangeCode, saveTokens } from "@/services/onshape/oauth";

/** Onshape redirects here after the user grants access. */
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const raw = request.headers.get("cookie")?.match(/onshape_oauth=([^;]+)/)?.[1];
  let stored: { state?: string; next?: string } = {};
  try {
    stored = raw ? JSON.parse(decodeURIComponent(raw)) : {};
  } catch {
    stored = {};
  }
  const next = stored.next ?? "/integrations";

  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}${next}?onshape=error&reason=${reason}`);

  if (!code || !state || state !== stored.state) return fail("state");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  try {
    const tokens = await exchangeCode(code, `${origin}/api/onshape/callback`);
    await saveTokens(supabase, user.id, tokens);
  } catch {
    return fail("exchange");
  }

  const response = NextResponse.redirect(`${origin}${next}?onshape=connected`);
  response.cookies.delete("onshape_oauth");
  return response;
}
