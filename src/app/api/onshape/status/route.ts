import { NextResponse } from "next/server";
import { bearerAuth } from "@/lib/supabase/bearer";
import { isOnshapeConfigured, isOnshapeMock } from "@/services/onshape/config";
import { hasConnection } from "@/services/onshape/oauth";
import type { StatusResponse } from "@/services/onshape/types";

export async function GET(request: Request) {
  const auth = await bearerAuth(request);
  if (!auth) return NextResponse.json({ error: "not-signed-in" }, { status: 401 });
  const body: StatusResponse = {
    configured: isOnshapeConfigured(),
    mock: isOnshapeMock(),
    connected: await hasConnection(auth.supabase, auth.user.id),
  };
  return NextResponse.json(body);
}
