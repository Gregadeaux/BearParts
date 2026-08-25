import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export interface FavoriteFolder {
  folderId: string;
  name: string;
  /** favorites of subsystem folders deep-link to the subsystem page */
  href: string;
  subsystemId: string | null;
}

/** The user's favorite folder ids (for star toggles). */
export async function listFavoriteFolderIds(supabase: Client, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("folder_favorites")
    .select("folder_id")
    .eq("user_id", userId);
  if (error) throw new Error(`Could not load favorites: ${error.message}`);
  return data.map((r) => r.folder_id);
}

/** Favorites with names + subsystem-aware links, oldest first — the home row. */
export async function listFavoriteFolders(supabase: Client, userId: string): Promise<FavoriteFolder[]> {
  const { data, error } = await supabase
    .from("folder_favorites")
    .select("folder_id, created_at, folder:folders (id, name)")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw new Error(`Could not load favorites: ${error.message}`);
  const rows = data.filter((r) => r.folder !== null);
  if (rows.length === 0) return [];

  const { data: subsystems } = await supabase
    .from("subsystems")
    .select("id, folder_id")
    .in("folder_id", rows.map((r) => r.folder_id));
  const byFolder = new Map((subsystems ?? []).map((s) => [s.folder_id, s.id]));

  return rows.map((r) => {
    const subsystemId = byFolder.get(r.folder_id) ?? null;
    return {
      folderId: r.folder_id,
      name: (r.folder as unknown as { name: string }).name,
      href: subsystemId ? `/subsystems/${subsystemId}` : `/library?f=${r.folder_id}`,
      subsystemId,
    };
  });
}

export async function setFavorite(
  supabase: Client,
  userId: string,
  folderId: string,
  favorite: boolean,
): Promise<void> {
  if (favorite) {
    const { error } = await supabase
      .from("folder_favorites")
      .upsert({ user_id: userId, folder_id: folderId });
    if (error) throw new Error(`Could not favorite folder: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("folder_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("folder_id", folderId);
    if (error) throw new Error(`Could not unfavorite folder: ${error.message}`);
  }
}
