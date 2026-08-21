import { NextResponse } from "next/server";
import { bearerAuth } from "@/lib/supabase/bearer";
import { listSubsystems } from "@/services/subsystems.service";

/** Subsystems for the panel's destination picker (Bearer auth — iframe safe). */
export async function GET(request: Request) {
  const auth = await bearerAuth(request);
  if (!auth) return NextResponse.json({ error: "not-signed-in" }, { status: 401 });
  try {
    const subsystems = await listSubsystems(auth.supabase);
    return NextResponse.json({
      subsystems: subsystems.map((s) => ({
        id: s.id,
        name: s.name,
        folderId: s.folder_id,
        projectName: s.project?.name ?? null,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
