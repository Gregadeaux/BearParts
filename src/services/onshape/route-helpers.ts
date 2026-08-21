import { NextResponse } from "next/server";
import { bearerAuth, type BearerAuth } from "@/lib/supabase/bearer";
import { getValidAccessToken } from "./oauth";
import { OnshapeApiError } from "./client";
import type { OnshapeDocContext } from "./types";

export interface PanelAuth extends BearerAuth {
  onshapeToken: string;
}

/**
 * Auth for panel API routes: BearParts session from the Authorization header,
 * then the user's Onshape access token. Returns a NextResponse on failure.
 */
export async function panelAuth(request: Request): Promise<PanelAuth | NextResponse> {
  const auth = await bearerAuth(request);
  if (!auth) return NextResponse.json({ error: "not-signed-in" }, { status: 401 });
  const onshapeToken = await getValidAccessToken(auth.supabase, auth.user.id);
  if (!onshapeToken) return NextResponse.json({ error: "onshape-not-connected" }, { status: 403 });
  return { ...auth, onshapeToken };
}

/** Parse ?did=&wvm=&wvmid=&eid= into a document context, or a 400 response. */
export function docContextFrom(url: URL): OnshapeDocContext | NextResponse {
  const documentId = url.searchParams.get("did");
  const wvm = url.searchParams.get("wvm");
  const wvmId = url.searchParams.get("wvmid");
  const elementId = url.searchParams.get("eid");
  if (!documentId || !wvmId || !elementId || (wvm !== "w" && wvm !== "v")) {
    return NextResponse.json({ error: "missing document context" }, { status: 400 });
  }
  return { documentId, wvm, wvmId, elementId };
}

/** Map thrown errors to a JSON response (429 passes through for retry UI). */
export function onshapeErrorResponse(e: unknown): NextResponse {
  if (e instanceof OnshapeApiError) {
    return NextResponse.json({ error: e.message }, { status: e.status === 429 ? 429 : 502 });
  }
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Onshape request failed" },
    { status: 500 },
  );
}
