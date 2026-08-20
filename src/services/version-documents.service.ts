import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { deletePartFile, uploadAnyFile } from "./storage.service";

type Client = SupabaseClient<Database>;

export type VersionDocumentRow = Database["public"]["Tables"]["version_documents"]["Row"];
export type DocumentKind = "drawing" | "gcode";

export const GCODE_EXTENSIONS = [".nc", ".gcode", ".ngc", ".tap", ".cnc"];

/** .pdf → drawing, CNC extensions → gcode, anything else unsupported. */
export function documentKindOf(fileName: string): DocumentKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "drawing";
  if (GCODE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "gcode";
  return null;
}

function safeFileName(name: string) {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120) || "file";
}

/** All documents across a part's versions, oldest first — keyed by version id. */
export async function listVersionDocuments(
  supabase: Client,
  versionIds: string[],
): Promise<Record<string, VersionDocumentRow[]>> {
  if (versionIds.length === 0) return {};
  const { data, error } = await supabase
    .from("version_documents")
    .select("*")
    .in("version_id", versionIds)
    .order("created_at");
  if (error) throw new Error(`Could not load documents: ${error.message}`);
  const map: Record<string, VersionDocumentRow[]> = {};
  for (const row of data) (map[row.version_id] ??= []).push(row);
  return map;
}

export async function addVersionDocument(
  supabase: Client,
  userId: string,
  input: { versionId: string; libraryPartId: string; version: number; file: File },
): Promise<VersionDocumentRow> {
  const kind = documentKindOf(input.file.name);
  if (!kind) throw new Error("Only PDF drawings and G-code files are supported");

  const path = `library/${input.libraryPartId}/v${input.version}/docs/${crypto.randomUUID()}/${safeFileName(input.file.name)}`;
  await uploadAnyFile(supabase, input.file, path);

  const { data, error } = await supabase
    .from("version_documents")
    .insert({
      version_id: input.versionId,
      kind,
      file_name: input.file.name,
      path,
      size_bytes: input.file.size,
      uploaded_by: userId,
    })
    .select()
    .single();
  if (error) {
    await deletePartFile(supabase, path);
    throw new Error(`Could not save document: ${error.message}`);
  }
  return data;
}

export async function deleteVersionDocument(supabase: Client, id: string): Promise<void> {
  const { data, error } = await supabase
    .from("version_documents")
    .delete()
    .eq("id", id)
    .select("path")
    .single();
  if (error) throw new Error(`Could not delete document: ${error.message}`);
  if (data?.path) await deletePartFile(supabase, data.path);
}
