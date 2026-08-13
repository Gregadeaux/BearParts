import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PartFileType } from "@/types/part";

const BUCKET = "dxf"; // historical name — holds all part files (dxf + stl)

type Client = SupabaseClient<Database>;

/** Upload a file to an explicit bucket path. */
export async function uploadToPath(
  supabase: Client,
  file: File | Blob,
  path: string,
  fileType: PartFileType,
) {
  const contentTypes = { dxf: "application/dxf", stl: "model/stl", pdf: "application/pdf" };
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: contentTypes[fileType],
    upsert: true,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

/** Upload a standalone queue part file and return its storage path. */
export async function uploadPartFile(
  supabase: Client,
  file: File | Blob,
  partId: string,
  fileType: PartFileType,
) {
  return uploadToPath(supabase, file, `parts/${partId}.${fileType}`, fileType);
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
