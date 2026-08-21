import { NextResponse } from "next/server";
import { bearerAuth } from "@/lib/supabase/bearer";
import {
  createLibraryPartFromFile,
  queueImportedVersion,
} from "@/services/library-upload.service";
import { sendPush } from "@/services/notifications.service";
import { createFolder } from "@/services/folders.service";
import { PART_PRIORITIES, type PartPriority } from "@/types/part";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Imports without a subsystem land in a shared root "Onshape imports" folder. */
async function onshapeImportsFolderId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("folders")
    .select("id")
    .is("parent_id", null)
    .eq("name", "Onshape imports")
    .maybeSingle();
  if (data) return data.id;
  const folder = await createFolder(supabase, userId, "Onshape imports", null);
  return folder.id;
}

/**
 * Final step of the Onshape panel flow: take the exported file (which passed
 * through the client for preview + thumbnail) and create a library part,
 * optionally queueing it for fabrication.
 */
export async function POST(request: Request) {
  const auth = await bearerAuth(request);
  if (!auth) return NextResponse.json({ error: "not-signed-in" }, { status: 401 });
  const { supabase, user } = auth;

  const formData = await request.formData();
  const file = formData.get("file");
  const rawFolderId = formData.get("folderId");
  const name = ((formData.get("name") as string) || "").trim();
  if (!(file instanceof File) || file.size === 0 || !name) {
    return NextResponse.json({ error: "file and name are required" }, { status: 400 });
  }
  const folderId =
    typeof rawFolderId === "string" && rawFolderId
      ? rawFolderId
      : await onshapeImportsFolderId(supabase, user.id);

  const thumb = formData.get("thumb");
  const note = ((formData.get("note") as string) || "").trim() || undefined;

  try {
    const { part, version } = await createLibraryPartFromFile(supabase, user.id, {
      file,
      folderId,
      name,
      thumb: thumb instanceof File ? thumb : null,
      note,
    });

    let queuedPartId: string | null = null;
    if (formData.get("queue") === "1") {
      const quantity = Math.max(1, Number(formData.get("quantity")) || 1);
      const rawPriority = formData.get("priority");
      const priority = PART_PRIORITIES.some((p) => p.value === rawPriority)
        ? (rawPriority as PartPriority)
        : "normal";
      const material = ((formData.get("material") as string) || "").trim() || undefined;
      const queued = await queueImportedVersion(supabase, user.id, version, {
        name,
        quantity,
        priority,
        material,
      });
      queuedPartId = queued.id;
      await sendPush(
        null,
        {
          title: "New part in queue",
          body: `${queued.submitter?.display_name ?? "Someone"} queued "${name}" from Onshape`,
          url: `/parts/${queued.id}`,
        },
        user.id,
      );
    }

    return NextResponse.json({ libraryPartId: part.id, queuedPartId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 },
    );
  }
}
