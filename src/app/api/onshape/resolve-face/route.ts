import { NextResponse } from "next/server";
import { resolveFacePart } from "@/services/onshape/backend";
import { docContextFrom, onshapeErrorResponse, panelAuth } from "@/services/onshape/route-helpers";

/** SELECTION events only carry a face id — map it to its owning part. */
export async function GET(request: Request) {
  const auth = await panelAuth(request);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(request.url);
  const ctx = docContextFrom(url);
  if (ctx instanceof NextResponse) return ctx;
  const faceId = url.searchParams.get("faceId");
  if (!faceId) return NextResponse.json({ error: "faceId required" }, { status: 400 });

  try {
    return NextResponse.json(
      await resolveFacePart(auth.onshapeToken, ctx, faceId, url.searchParams.get("mv")),
    );
  } catch (e) {
    return onshapeErrorResponse(e);
  }
}
