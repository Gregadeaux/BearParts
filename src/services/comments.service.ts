import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ProfileRow } from "@/types/part";

type Client = SupabaseClient<Database>;

/** A comment pinned to a point on a specific version's geometry (inches). */
export interface CommentAnchor {
  x: number;
  y: number;
  versionId: string;
  label?: string;
  /** characteristic feature size (hole diameter), inches */
  size?: number;
}

export interface PartComment {
  id: string;
  library_part_id: string;
  author_id: string;
  body: string;
  anchor: CommentAnchor | null;
  created_at: string;
  author: Pick<ProfileRow, "id" | "display_name" | "avatar_url"> | null;
}

const COMMENT_SELECT = `*, author:profiles (id, display_name, avatar_url)`;

/** Comments for a part, oldest first (chat order). */
export async function listComments(supabase: Client, libraryPartId: string): Promise<PartComment[]> {
  const { data, error } = await supabase
    .from("part_comments")
    .select(COMMENT_SELECT)
    .eq("library_part_id", libraryPartId)
    .order("created_at");
  if (error) throw new Error(`Could not load comments: ${error.message}`);
  return data as unknown as PartComment[];
}

export async function createComment(
  supabase: Client,
  userId: string,
  libraryPartId: string,
  body: string,
  anchor?: CommentAnchor,
): Promise<PartComment> {
  const { data, error } = await supabase
    .from("part_comments")
    .insert({
      library_part_id: libraryPartId,
      author_id: userId,
      body,
      anchor: (anchor ?? null) as never,
    })
    .select(COMMENT_SELECT)
    .single();
  if (error) throw new Error(`Could not post comment: ${error.message}`);
  return data as unknown as PartComment;
}

export async function deleteComment(supabase: Client, id: string) {
  const { error } = await supabase.from("part_comments").delete().eq("id", id);
  if (error) throw new Error(`Could not delete comment: ${error.message}`);
}
