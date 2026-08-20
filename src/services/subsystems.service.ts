import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ProfileRow } from "@/types/part";
import { subtreeFolderIds } from "./library.service";

type Client = SupabaseClient<Database>;

export type SubsystemRow = Database["public"]["Tables"]["subsystems"]["Row"];

export interface Subsystem extends SubsystemRow {
  project: { id: string; name: string } | null;
  folder: { id: string; name: string } | null;
}

const SUBSYSTEM_SELECT = `*, project:projects (id, name), folder:folders (id, name)`;

export async function listSubsystems(supabase: Client): Promise<Subsystem[]> {
  const { data, error } = await supabase.from("subsystems").select(SUBSYSTEM_SELECT).order("name");
  if (error) throw new Error(`Could not load subsystems: ${error.message}`);
  return data as unknown as Subsystem[];
}

export async function getSubsystem(supabase: Client, id: string): Promise<Subsystem | null> {
  const { data, error } = await supabase
    .from("subsystems")
    .select(SUBSYSTEM_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load subsystem: ${error.message}`);
  return data as unknown as Subsystem | null;
}

export async function createSubsystem(
  supabase: Client,
  userId: string,
  input: { name: string; projectId: string; folderId: string },
): Promise<SubsystemRow> {
  const { data, error } = await supabase
    .from("subsystems")
    .insert({
      name: input.name.trim(),
      project_id: input.projectId,
      folder_id: input.folderId,
      created_by: userId,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("This folder already has a subsystem");
    throw new Error(`Could not create subsystem: ${error.message}`);
  }
  return data;
}

export async function deleteSubsystem(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from("subsystems").delete().eq("id", id);
  if (error) throw new Error(`Could not delete subsystem: ${error.message}`);
}

/** Ids of every library part in the subsystem's folder subtree. */
export async function subsystemPartIds(supabase: Client, subsystem: SubsystemRow): Promise<string[]> {
  const folderIds = await subtreeFolderIds(supabase, subsystem.folder_id);
  const { data, error } = await supabase
    .from("library_parts")
    .select("id")
    .in("folder_id", folderIds);
  if (error) throw new Error(`Could not load subsystem parts: ${error.message}`);
  return data.map((p) => p.id);
}

export interface SubsystemQueuePart {
  id: string;
  name: string;
  status: string;
  quantity: number;
  created_at: string;
  assignee: Pick<ProfileRow, "id" | "display_name" | "avatar_url"> | null;
}

/** Fab-queue entries created from any version of the subsystem's parts. */
export async function subsystemQueueParts(
  supabase: Client,
  libraryPartIds: string[],
): Promise<SubsystemQueuePart[]> {
  if (libraryPartIds.length === 0) return [];
  const { data: versions, error: vError } = await supabase
    .from("part_versions")
    .select("id")
    .in("library_part_id", libraryPartIds);
  if (vError) throw new Error(`Could not load versions: ${vError.message}`);
  if (versions.length === 0) return [];

  const { data, error } = await supabase
    .from("parts")
    .select(`id, name, status, quantity, created_at,
      assignee:profiles!parts_assigned_to_fkey (id, display_name, avatar_url)`)
    .in("source_version_id", versions.map((v) => v.id))
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load queue entries: ${error.message}`);
  return data as unknown as SubsystemQueuePart[];
}

export interface SubsystemUpload {
  id: string;
  version: number;
  created_at: string;
  library_part: { id: string; name: string } | null;
  uploader: Pick<ProfileRow, "id" | "display_name" | "avatar_url"> | null;
}

/** Version uploads across the subsystem's parts, newest first — the history feed. */
export async function subsystemUploads(
  supabase: Client,
  libraryPartIds: string[],
  limit = 25,
): Promise<SubsystemUpload[]> {
  if (libraryPartIds.length === 0) return [];
  const { data, error } = await supabase
    .from("part_versions")
    .select(`id, version, created_at,
      library_part:library_parts (id, name),
      uploader:profiles (id, display_name, avatar_url)`)
    .in("library_part_id", libraryPartIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load upload history: ${error.message}`);
  return data as unknown as SubsystemUpload[];
}

/** library part id → latest version's thumb storage path (for BOM thumbnails). */
export async function latestThumbPaths(
  supabase: Client,
  libraryPartIds: string[],
): Promise<Record<string, string>> {
  if (libraryPartIds.length === 0) return {};
  const { data, error } = await supabase
    .from("part_versions")
    .select("library_part_id, version, thumb_path")
    .in("library_part_id", libraryPartIds)
    .not("thumb_path", "is", null)
    .order("version", { ascending: false });
  if (error) throw new Error(`Could not load thumbnails: ${error.message}`);
  const map: Record<string, string> = {};
  for (const row of data) {
    if (!(row.library_part_id in map) && row.thumb_path) map[row.library_part_id] = row.thumb_path;
  }
  return map;
}

/** Name lookup for the BOM's "custom part" picker. */
export async function subsystemPartNames(
  supabase: Client,
  libraryPartIds: string[],
): Promise<{ id: string; name: string }[]> {
  if (libraryPartIds.length === 0) return [];
  const { data, error } = await supabase
    .from("library_parts")
    .select("id, name")
    .in("id", libraryPartIds)
    .order("name");
  if (error) throw new Error(`Could not load parts: ${error.message}`);
  return data;
}
