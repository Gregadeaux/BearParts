import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ProfileRow } from "@/types/part";

type Client = SupabaseClient<Database>;

export type PartEventType =
  | "queued"
  | "assigned"
  | "unassigned"
  | "started"
  | "completed"
  | "rejected"
  | "requeued"
  | "removed";

export interface PartEvent {
  id: string;
  part_id: string | null;
  library_part_id: string;
  version: number | null;
  event: PartEventType;
  detail: { assignee?: string } | null;
  created_at: string;
  actor: Pick<ProfileRow, "id" | "display_name" | "avatar_url"> | null;
}

/** Fab-queue audit events for a library part, newest first. */
export async function listPartEvents(supabase: Client, libraryPartId: string): Promise<PartEvent[]> {
  const { data, error } = await supabase
    .from("part_events")
    .select(`*, actor:profiles (id, display_name, avatar_url)`)
    .eq("library_part_id", libraryPartId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load history: ${error.message}`);
  return data as unknown as PartEvent[];
}
