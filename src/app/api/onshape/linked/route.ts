import { NextResponse } from "next/server";
import { bearerAuth } from "@/lib/supabase/bearer";
import type { LinkedPartResponse } from "@/services/onshape/types";

/**
 * Is this Onshape part already in the library? Pure database lookup — costs
 * zero Onshape API calls. Returns the linked part with its fab status.
 */
export async function GET(request: Request) {
  const auth = await bearerAuth(request);
  if (!auth) return NextResponse.json({ error: "not-signed-in" }, { status: 401 });
  const { supabase } = auth;

  const url = new URL(request.url);
  const documentId = url.searchParams.get("did");
  const elementId = url.searchParams.get("eid");
  const partId = url.searchParams.get("partId");
  if (!documentId || !elementId || !partId) {
    return NextResponse.json({ error: "did, eid and partId required" }, { status: 400 });
  }

  const { data: matches, error } = await supabase
    .from("library_parts")
    .select("id, name, folder_id, updated_at, folders (name)")
    .eq("onshape_document_id", documentId)
    .eq("onshape_element_id", elementId)
    .eq("onshape_part_id", partId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const match = matches?.[0];
  if (!match) return NextResponse.json({ linked: null } satisfies LinkedPartResponse);

  const { data: versions } = await supabase
    .from("part_versions")
    .select("id, version")
    .eq("library_part_id", match.id)
    .order("version", { ascending: false });
  const latestVersion = versions?.[0]?.version ?? 0;

  let queue: { id: string; status: string; quantity: number }[] = [];
  if (versions && versions.length > 0) {
    const { data: entries } = await supabase
      .from("parts")
      .select("id, status, quantity")
      .in("source_version_id", versions.map((v) => v.id))
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    queue = entries ?? [];
  }

  const body: LinkedPartResponse = {
    linked: {
      libraryPartId: match.id,
      name: match.name,
      latestVersion,
      folderName: (match.folders as unknown as { name: string } | null)?.name ?? null,
      queue,
    },
  };
  return NextResponse.json(body);
}
