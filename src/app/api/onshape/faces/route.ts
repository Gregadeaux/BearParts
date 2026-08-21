import { NextResponse } from "next/server";
import { planarFaces } from "@/services/onshape/backend";
import { docContextFrom, onshapeErrorResponse, panelAuth } from "@/services/onshape/route-helpers";

/** Planar faces of one part, with 2D envelope sizes (inches). */
export async function GET(request: Request) {
  const auth = await panelAuth(request);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(request.url);
  const ctx = docContextFrom(url);
  if (ctx instanceof NextResponse) return ctx;
  const partId = url.searchParams.get("partId");
  if (!partId) return NextResponse.json({ error: "partId required" }, { status: 400 });

  try {
    return NextResponse.json(await planarFaces(auth.onshapeToken, ctx, partId));
  } catch (e) {
    return onshapeErrorResponse(e);
  }
}
