import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { SubgroupRow, Task, TaskStatus } from "@/types/task";

type Client = SupabaseClient<Database>;

const TASK_SELECT = `*,
  subgroup:subgroups (*),
  task_assignees (user:profiles (id, display_name, avatar_url)),
  task_tags (tag)`;

interface RawTask {
  task_assignees: { user: Task["assignees"][number] | null }[];
  task_tags: { tag: string }[];
  [key: string]: unknown;
}

function shapeTask(raw: RawTask): Task {
  const { task_assignees, task_tags, ...rest } = raw;
  return {
    ...(rest as unknown as Omit<Task, "assignees" | "tags">),
    assignees: task_assignees.map((a) => a.user).filter((u): u is Task["assignees"][number] => u !== null),
    tags: task_tags.map((t) => t.tag).sort(),
  };
}

export interface TaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  subgroupId?: string | null;
  startDate?: string | null; // ISO date (yyyy-mm-dd)
  dueDate?: string | null;
}

export async function listTasks(supabase: Client): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load tasks: ${error.message}`);
  return (data as unknown as RawTask[]).map(shapeTask);
}

export async function getTask(supabase: Client, id: string): Promise<Task | null> {
  const { data, error } = await supabase.from("tasks").select(TASK_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load task: ${error.message}`);
  return data ? shapeTask(data as unknown as RawTask) : null;
}

export async function createTask(supabase: Client, userId: string, input: TaskInput): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      status: input.status ?? "todo",
      subgroup_id: input.subgroupId ?? null,
      start_date: input.startDate ?? null,
      due_date: input.dueDate ?? null,
      created_by: userId,
    })
    .select(TASK_SELECT)
    .single();
  if (error) throw new Error(`Could not create task: ${error.message}`);
  return shapeTask(data as unknown as RawTask);
}

export async function updateTask(supabase: Client, id: string, input: Partial<TaskInput>): Promise<void> {
  const patch: Database["public"]["Tables"]["tasks"]["Update"] = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.status !== undefined) patch.status = input.status;
  if (input.subgroupId !== undefined) patch.subgroup_id = input.subgroupId;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.dueDate !== undefined) patch.due_date = input.dueDate;
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw new Error(`Could not update task: ${error.message}`);
}

/** Replace the assignee set. Returns ids that were newly added (for notifications). */
export async function setAssignees(supabase: Client, taskId: string, userIds: string[]): Promise<string[]> {
  const { data: current } = await supabase
    .from("task_assignees")
    .select("user_id")
    .eq("task_id", taskId);
  const existing = new Set((current ?? []).map((r) => r.user_id));
  const added = userIds.filter((id) => !existing.has(id));

  const { error: delError } = await supabase
    .from("task_assignees")
    .delete()
    .eq("task_id", taskId)
    .not("user_id", "in", `(${userIds.length ? userIds.join(",") : "00000000-0000-0000-0000-000000000000"})`);
  if (delError) throw new Error(`Could not update assignees: ${delError.message}`);

  if (added.length > 0) {
    const { error } = await supabase
      .from("task_assignees")
      .insert(added.map((user_id) => ({ task_id: taskId, user_id })));
    if (error) throw new Error(`Could not update assignees: ${error.message}`);
  }
  return added;
}

/** Replace the tag set. */
export async function setTags(supabase: Client, taskId: string, tags: string[]): Promise<void> {
  const clean = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  const { error: delError } = await supabase.from("task_tags").delete().eq("task_id", taskId);
  if (delError) throw new Error(`Could not update tags: ${delError.message}`);
  if (clean.length > 0) {
    const { error } = await supabase
      .from("task_tags")
      .insert(clean.map((tag) => ({ task_id: taskId, tag })));
    if (error) throw new Error(`Could not update tags: ${error.message}`);
  }
}

export async function deleteTask(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(`Could not delete task: ${error.message}`);
}

/** Every tag in use — powers tag suggestions. */
export async function listAllTags(supabase: Client): Promise<string[]> {
  const { data, error } = await supabase.from("task_tags").select("tag");
  if (error) throw new Error(`Could not load tags: ${error.message}`);
  return [...new Set(data.map((r) => r.tag))].sort();
}

export async function listSubgroups(supabase: Client): Promise<SubgroupRow[]> {
  const { data, error } = await supabase.from("subgroups").select("*").order("name");
  if (error) throw new Error(`Could not load subgroups: ${error.message}`);
  return data;
}

export async function createSubgroup(supabase: Client, name: string, color: string): Promise<SubgroupRow> {
  const { data, error } = await supabase
    .from("subgroups")
    .insert({ name: name.trim(), color })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error(`Subgroup "${name}" already exists`);
    throw new Error(`Could not create subgroup: ${error.message}`);
  }
  return data;
}
