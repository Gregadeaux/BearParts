import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { FolderRow } from "@/types/library";

type Client = SupabaseClient<Database>;

/** Children of a folder (null = root). */
export async function listFolders(supabase: Client, parentId: string | null): Promise<FolderRow[]> {
  let query = supabase.from("folders").select("*").order("name");
  query = parentId === null ? query.is("parent_id", null) : query.eq("parent_id", parentId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load folders: ${error.message}`);
  return data;
}

export async function getFolder(supabase: Client, id: string): Promise<FolderRow | null> {
  const { data, error } = await supabase.from("folders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load folder: ${error.message}`);
  return data;
}

/** Walk parent links to the root — powers the breadcrumb. Root-first order. */
export async function getAncestry(supabase: Client, folderId: string): Promise<FolderRow[]> {
  const chain: FolderRow[] = [];
  let current: string | null = folderId;
  let guard = 20;
  while (current && guard-- > 0) {
    const folder = await getFolder(supabase, current);
    if (!folder) break;
    chain.unshift(folder);
    current = folder.parent_id;
  }
  return chain;
}

export async function createFolder(
  supabase: Client,
  userId: string,
  name: string,
  parentId: string | null,
): Promise<FolderRow> {
  const { data, error } = await supabase
    .from("folders")
    .insert({ name: name.trim(), parent_id: parentId, created_by: userId })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error(`A folder named "${name}" already exists here`);
    throw new Error(`Could not create folder: ${error.message}`);
  }
  return data;
}

/** Delete only when empty — cascading a season's worth of files is not a click. */
export async function deleteEmptyFolder(supabase: Client, id: string) {
  const [{ count: subfolders }, { count: parts }] = await Promise.all([
    supabase.from("folders").select("id", { count: "exact", head: true }).eq("parent_id", id),
    supabase.from("library_parts").select("id", { count: "exact", head: true }).eq("folder_id", id),
  ]);
  if ((subfolders ?? 0) > 0 || (parts ?? 0) > 0) {
    throw new Error("Folder isn't empty");
  }
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) throw new Error(`Could not delete folder: ${error.message}`);
}
