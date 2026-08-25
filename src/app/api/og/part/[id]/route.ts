import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Public preview PNG for a fab-queue part (og:image — id is the capability). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: part } = await supabase
    .from("parts")
    .select("thumb_path")
    .eq("id", id)
    .maybeSingle();
  if (!part?.thumb_path) return new NextResponse(null, { status: 404 });

  const { data: file } = await supabase.storage.from("dxf").download(part.thumb_path);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(file, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
