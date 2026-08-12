import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const BUCKET = "dxf";

type Client = SupabaseClient<Database>;

/** Upload a DXF and return its storage path. */
export async function uploadDxf(supabase: Client, file: File | Blob, partId: string) {
  const path = `parts/${partId}.dxf`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: "application/dxf",
    upsert: true,
  });
  if (error) throw new Error(`DXF upload failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL for downloading a DXF. */
export async function getDxfUrl(supabase: Client, path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw new Error(`Could not sign DXF URL: ${error.message}`);
  return data.signedUrl;
}

/** Fetch DXF text content via a signed URL. */
export async function downloadDxfText(supabase: Client, path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(`Could not download DXF: ${error.message}`);
  return data.text();
}

export async function deleteDxf(supabase: Client, path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}
