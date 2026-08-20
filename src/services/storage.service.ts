import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PartFileType } from "@/types/part";

const BUCKET = "dxf"; // historical name — holds all part files (dxf + stl)

type Client = SupabaseClient<Database>;

const CONTENT_TYPES: Record<string, string> = {
  dxf: "application/dxf",
  stl: "model/stl",
  pdf: "application/pdf",
  png: "image/png",
};

/** Upload a file to an explicit bucket path; kind picks the content type. */
export async function uploadToPath(
  supabase: Client,
  file: File | Blob,
  path: string,
  kind: PartFileType | "png",
) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: CONTENT_TYPES[kind],
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

/** Upload an arbitrary file (task attachments) — content type comes from the file itself. */
export async function uploadAnyFile(supabase: Client, file: File | Blob, path: string) {
  const contentType = ("type" in file && file.type) || "application/octet-stream";
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL for downloading a part file. */
export async function getFileUrl(supabase: Client, path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw new Error(`Could not sign file URL: ${error.message}`);
  return data.signedUrl;
}

/** Signed URL that forces a download with the given file name. */
export async function getDownloadUrl(supabase: Client, path: string, fileName: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60, { download: fileName });
  if (error) throw new Error(`Could not sign file URL: ${error.message}`);
  return data.signedUrl;
}

export async function deletePartFile(supabase: Client, path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}
