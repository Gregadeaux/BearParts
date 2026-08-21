import { NextResponse } from "next/server";
import { exportFaceDxf, exportStep } from "@/services/onshape/backend";
import { onshapeErrorResponse, panelAuth } from "@/services/onshape/route-helpers";
import type { OnshapeDocContext } from "@/services/onshape/types";

interface ExportBody {
  mode: "dxf" | "step";
  context: OnshapeDocContext;
  partId: string;
  faceId?: string;
}

/**
 * Run the export on the server (Onshape tokens never reach the browser).
 * DXF returns JSON; STEP streams the file bytes.
 */
export async function POST(request: Request) {
  const auth = await panelAuth(request);
  if (auth instanceof NextResponse) return auth;

  let body: ExportBody;
  try {
    body = (await request.json()) as ExportBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { mode, context, partId, faceId } = body;
  if (
    !context?.documentId ||
    !context.wvmId ||
    !context.elementId ||
    (context.wvm !== "w" && context.wvm !== "v") ||
    !partId
  ) {
    return NextResponse.json({ error: "missing document context" }, { status: 400 });
  }

  try {
    if (mode === "dxf") {
      if (!faceId) return NextResponse.json({ error: "faceId required" }, { status: 400 });
      return NextResponse.json(await exportFaceDxf(auth.onshapeToken, context, partId, faceId));
    }
    if (mode === "step") {
      const bytes = await exportStep(auth.onshapeToken, context, partId);
      return new NextResponse(Buffer.from(bytes), {
        headers: { "Content-Type": "application/step" },
      });
    }
    return NextResponse.json({ error: "unknown mode" }, { status: 400 });
  } catch (e) {
    return onshapeErrorResponse(e);
  }
}
