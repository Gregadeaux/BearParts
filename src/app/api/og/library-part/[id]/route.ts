import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Public preview PNG for a library part's latest version (og:image). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: versions } = await supabase
    .from("part_versions")
    .select("thumb_path, version")
    .eq("library_part_id", id)
    .not("thumb_path", "is", null)
    .order("version", { ascending: false })
    .limit(1);
  const thumbPath = versions?.[0]?.thumb_path;
  if (!thumbPath) return new NextResponse(null, { status: 404 });

  const { data: file } = await supabase.storage.from("dxf").download(thumbPath);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(file, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
