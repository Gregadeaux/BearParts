import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ProfileRow } from "@/types/part";

type Client = SupabaseClient<Database>;

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: Pick<ProfileRow, "id" | "display_name" | "avatar_url"> | null;
}

const COMMENT_SELECT = `*, author:profiles (id, display_name, avatar_url)`;

/** Comments for a task, oldest first (chat order). */
export async function listTaskComments(supabase: Client, taskId: string): Promise<TaskComment[]> {
  const { data, error } = await supabase
    .from("task_comments")
    .select(COMMENT_SELECT)
    .eq("task_id", taskId)
    .order("created_at");
  if (error) throw new Error(`Could not load comments: ${error.message}`);
  return data as unknown as TaskComment[];
}

export async function createTaskComment(
  supabase: Client,
  userId: string,
  taskId: string,
  body: string,
): Promise<TaskComment> {
  const { data, error } = await supabase
    .from("task_comments")
    .insert({ task_id: taskId, author_id: userId, body })
    .select(COMMENT_SELECT)
    .single();
  if (error) throw new Error(`Could not post comment: ${error.message}`);
  return data as unknown as TaskComment;
}

export async function deleteTaskComment(supabase: Client, id: string) {
  const { error } = await supabase.from("task_comments").delete().eq("id", id);
  if (error) throw new Error(`Could not delete comment: ${error.message}`);
}
