import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { LibraryPartDetail, LibraryPartListing, PartVersion } from "@/types/library";
import type { PartFileType } from "@/types/part";
import type { DxfAnalysis, Units } from "@/types/analysis";

type Client = SupabaseClient<Database>;

const VERSION_SELECT = `*, uploader:profiles (id, display_name, avatar_url)`;

export interface NewVersionInput {
  filePath: string;
  fileType: PartFileType;
  units?: Units;
  analysis?: DxfAnalysis;
  note?: string;
  thumbPath?: string;
}

/** Parts in a folder, each with its latest version attached. */
export async function listLibraryParts(
  supabase: Client,
  folderId: string,
): Promise<LibraryPartListing[]> {
  const { data, error } = await supabase
    .from("library_parts")
    .select(`*, versions:part_versions (${VERSION_SELECT})`)
    .eq("folder_id", folderId)
    .order("name");
  if (error) throw new Error(`Could not load parts: ${error.message}`);

  return (data as unknown as (LibraryPartListing & { versions: PartVersion[] })[]).map(
    ({ versions, ...part }) => {
      const sorted = [...versions].sort((a, b) => b.version - a.version);
      return { ...part, latest: sorted[0] ?? null, versionCount: sorted.length };
    },
  );
}

export interface LibrarySearchResult {
  parts: (LibraryPartListing & { folderName: string | null })[];
  folders: { id: string; name: string }[];
}

/** Name search across the whole library — parts (with latest version) and folders. */
export async function searchLibrary(supabase: Client, query: string): Promise<LibrarySearchResult> {
  const like = `%${query.replaceAll("%", "\\%")}%`;
  const [partsRes, foldersRes] = await Promise.all([
    supabase
      .from("library_parts")
      .select(`*, folder:folders (name), versions:part_versions (${VERSION_SELECT})`)
      .ilike("name", like)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase.from("folders").select("id, name").ilike("name", like).order("name").limit(12),
  ]);
  if (partsRes.error) throw new Error(`Search failed: ${partsRes.error.message}`);
  if (foldersRes.error) throw new Error(`Search failed: ${foldersRes.error.message}`);

  const parts = (
    partsRes.data as unknown as (LibraryPartListing & {
      folder: { name: string } | null;
      versions: PartVersion[];
    })[]
  ).map(({ versions, folder, ...part }) => {
    const sorted = [...versions].sort((a, b) => b.version - a.version);
    return {
      ...part,
      latest: sorted[0] ?? null,
      versionCount: sorted.length,
      folderName: folder?.name ?? null,
    };
  });

  return { parts, folders: foldersRes.data };
}

/** Full detail: versions newest-first + fab queue history. */
export async function getLibraryPart(
  supabase: Client,
  id: string,
): Promise<LibraryPartDetail | null> {
  const { data, error } = await supabase
    .from("library_parts")
    .select(`*, versions:part_versions (${VERSION_SELECT})`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load part: ${error.message}`);
  if (!data) return null;

  const versions = (data.versions as unknown as PartVersion[]).sort(
    (a, b) => b.version - a.version,
  );

  const { data: queueEntries, error: qError } = await supabase
    .from("parts")
    .select(`id, status, quantity, created_at, source_version_id,
      assignee:profiles!parts_assigned_to_fkey (id, display_name, avatar_url)`)
    .in("source_version_id", versions.map((v) => v.id))
    .order("created_at", { ascending: false });
  if (qError) throw new Error(`Could not load queue history: ${qError.message}`);

  return {
    ...(data as unknown as LibraryPartDetail),
    versions,
    queueEntries: (queueEntries ?? []) as unknown as LibraryPartDetail["queueEntries"],
  };
}

/** Create the part row itself — the caller uploads the file and inserts v1. */
export async function createLibraryPartRow(
  supabase: Client,
  userId: string,
  folderId: string,
  name: string,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("library_parts")
    .insert({ folder_id: folderId, name: name.trim(), created_by: userId })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create part: ${error.message}`);
  return data;
}

/** The version number the next upload should get. */
export async function nextVersionNumber(supabase: Client, libraryPartId: string): Promise<number> {
  const { data } = await supabase
    .from("part_versions")
    .select("version")
    .eq("library_part_id", libraryPartId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.version ?? 0) + 1;
}

export async function getVersion(supabase: Client, versionId: string): Promise<PartVersion | null> {
  const { data, error } = await supabase
    .from("part_versions")
    .select(VERSION_SELECT)
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw new Error(`Could not load version: ${error.message}`);
  return data as unknown as PartVersion | null;
}

export async function insertVersion(
  supabase: Client,
  userId: string,
  libraryPartId: string,
  versionNumber: number,
  input: NewVersionInput,
): Promise<PartVersion> {
  const { data, error } = await supabase
    .from("part_versions")
    .insert({
      library_part_id: libraryPartId,
      version: versionNumber,
      file_path: input.filePath,
      file_type: input.fileType,
      units: input.units ?? "unknown",
      analysis: (input.analysis ?? null) as never,
      note: input.note?.trim() || null,
      thumb_path: input.thumbPath ?? null,
      uploaded_by: userId,
    })
    .select(VERSION_SELECT)
    .single();
  if (error) throw new Error(`Could not save version: ${error.message}`);
  return data as unknown as PartVersion;
}

/** Storage path for a library version file. */
export function versionFilePath(libraryPartId: string, version: number, fileType: PartFileType) {
  return `library/${libraryPartId}/v${version}.${fileType}`;
}

/** Storage path for a version's preview PNG. */
export function versionThumbPath(libraryPartId: string, version: number) {
  return `library/${libraryPartId}/v${version}.thumb.png`;
}
