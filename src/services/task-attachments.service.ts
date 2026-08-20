import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { TaskAttachment } from "@/types/task";
import { deletePartFile, uploadAnyFile } from "./storage.service";

type Client = SupabaseClient<Database>;

/** Storage keys only tolerate a conservative character set. */
function safeFileName(name: string) {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120) || "file";
}

/** Upload the file, then record it — the random path segment avoids name collisions. */
export async function addAttachment(
  supabase: Client,
  userId: string,
  taskId: string,
  file: File,
): Promise<TaskAttachment> {
  const path = `tasks/${taskId}/${crypto.randomUUID()}/${safeFileName(file.name)}`;
  await uploadAnyFile(supabase, file, path);

  const { data, error } = await supabase
    .from("task_attachments")
    .insert({
      task_id: taskId,
      file_name: file.name,
      path,
      size_bytes: file.size,
      uploaded_by: userId,
    })
    .select("id, file_name, path, size_bytes, created_at")
    .single();
  if (error) {
    await deletePartFile(supabase, path);
    throw new Error(`Could not save attachment: ${error.message}`);
  }
  return data;
}

/** Remove the row and its stored file. */
export async function deleteAttachment(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("task_attachments")
    .delete()
    .eq("id", id)
    .select("path")
    .single();
  if (error) throw new Error(`Could not delete attachment: ${error.message}`);
  if (data?.path) await deletePartFile(supabase, data.path);
}

export async function getAttachment(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("task_attachments")
    .select("id, task_id, file_name, path, size_bytes, created_at")
    .eq("id", id)
    .single();
  if (error) throw new Error(`Could not load attachment: ${error.message}`);
  return data;
}
