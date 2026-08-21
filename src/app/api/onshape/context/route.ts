import { NextResponse } from "next/server";
import { studioContext } from "@/services/onshape/backend";
import { docContextFrom, onshapeErrorResponse, panelAuth } from "@/services/onshape/route-helpers";

/** Document/element names + the studio's parts — the panel's bootstrap call. */
export async function GET(request: Request) {
  const auth = await panelAuth(request);
  if (auth instanceof NextResponse) return auth;
  const ctx = docContextFrom(new URL(request.url));
  if (ctx instanceof NextResponse) return ctx;

  try {
    return NextResponse.json(await studioContext(auth.onshapeToken, ctx));
  } catch (e) {
    return onshapeErrorResponse(e);
  }
}
