import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ProfileRow } from "@/types/part";

type Client = SupabaseClient<Database>;

export interface SubsystemComment {
  id: string;
  subsystem_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: Pick<ProfileRow, "id" | "display_name" | "avatar_url"> | null;
}

const COMMENT_SELECT = `*, author:profiles (id, display_name, avatar_url)`;

/** Comments for a subsystem, oldest first (chat order). */
export async function listSubsystemComments(
  supabase: Client,
  subsystemId: string,
): Promise<SubsystemComment[]> {
  const { data, error } = await supabase
    .from("subsystem_comments")
    .select(COMMENT_SELECT)
    .eq("subsystem_id", subsystemId)
    .order("created_at");
  if (error) throw new Error(`Could not load comments: ${error.message}`);
  return data as unknown as SubsystemComment[];
}

export async function createSubsystemComment(
  supabase: Client,
  userId: string,
  subsystemId: string,
  body: string,
): Promise<SubsystemComment> {
  const { data, error } = await supabase
    .from("subsystem_comments")
    .insert({ subsystem_id: subsystemId, author_id: userId, body })
    .select(COMMENT_SELECT)
    .single();
  if (error) throw new Error(`Could not post comment: ${error.message}`);
  return data as unknown as SubsystemComment;
}

export async function deleteSubsystemComment(supabase: Client, id: string) {
  const { error } = await supabase.from("subsystem_comments").delete().eq("id", id);
  if (error) throw new Error(`Could not delete comment: ${error.message}`);
}
