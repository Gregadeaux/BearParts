import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PartFileType } from "@/types/part";

const BUCKET = "dxf"; // historical name — holds all part files (dxf + stl)

type Client = SupabaseClient<Database>;

/** Upload a part file and return its storage path. */
export async function uploadPartFile(
  supabase: Client,
  file: File | Blob,
  partId: string,
  fileType: PartFileType,
) {
  const path = `parts/${partId}.${fileType}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: fileType === "dxf" ? "application/dxf" : "model/stl",
    upsert: true,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL for downloading a part file. */
export async function getFileUrl(supabase: Client, path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw new Error(`Could not sign file URL: ${error.message}`);
  return data.signedUrl;
}

export async function deletePartFile(supabase: Client, path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}
