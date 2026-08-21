import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicOrigin } from "@/lib/public-origin";
import { isOnshapeConfigured, isOnshapeMock } from "@/services/onshape/config";
import { authorizeUrl } from "@/services/onshape/oauth";

/**
 * Kick off the Onshape OAuth dance. Runs top-level (popup or full page), so
 * normal cookie auth applies. `?next=` says where to land afterwards.
 */
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const next = new URL(request.url).searchParams.get("next") ?? "/integrations";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  if (isOnshapeMock()) return NextResponse.redirect(`${origin}${next}?onshape=connected`);
  if (!isOnshapeConfigured()) {
    return NextResponse.redirect(`${origin}${next}?onshape=not-configured`);
  }

  const state = crypto.randomUUID();
  const response = NextResponse.redirect(
    authorizeUrl(`${origin}/api/onshape/callback`, state),
  );
  response.cookies.set("onshape_oauth", JSON.stringify({ state, next }), {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/onshape",
  });
  return response;
}
