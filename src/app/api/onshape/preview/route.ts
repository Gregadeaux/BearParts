import { NextResponse } from "next/server";
import { shadedViewPng } from "@/services/onshape/backend";
import { docContextFrom, onshapeErrorResponse, panelAuth } from "@/services/onshape/route-helpers";

/** Shaded-view PNG of one part (served binary; fetched with Bearer auth). */
export async function GET(request: Request) {
  const auth = await panelAuth(request);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(request.url);
  const ctx = docContextFrom(url);
  if (ctx instanceof NextResponse) return ctx;
  const partId = url.searchParams.get("partId");
  if (!partId) return NextResponse.json({ error: "partId required" }, { status: 400 });

  try {
    const png = await shadedViewPng(auth.onshapeToken, ctx, partId);
    return new NextResponse(Buffer.from(png), {
      headers: {
        "Content-Type": "image/png",
        // previews are cheap to reuse — the browser cache saves Onshape calls
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    return onshapeErrorResponse(e);
  }
}
