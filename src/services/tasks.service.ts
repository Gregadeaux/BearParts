import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ProjectRow, SubgroupRow, Task, TaskStatus } from "@/types/task";

type Client = SupabaseClient<Database>;

const TASK_SELECT = `*,
  subgroup:subgroups (*),
  project:projects (*),
  task_assignees (user:profiles (id, display_name, avatar_url)),
  task_tags (tag),
  task_subtasks (id, title, done, position),
  task_attachments (id, file_name, path, size_bytes, created_at)`;

interface RawTask {
  task_assignees: { user: Task["assignees"][number] | null }[];
  task_tags: { tag: string }[];
  task_subtasks: Task["subtasks"];
  task_attachments: Task["attachments"];
  [key: string]: unknown;
}

function shapeTask(raw: RawTask): Task {
  const { task_assignees, task_tags, task_subtasks, task_attachments, ...rest } = raw;
  return {
    ...(rest as unknown as Omit<Task, "assignees" | "tags" | "subtasks" | "attachments">),
    assignees: task_assignees.map((a) => a.user).filter((u): u is Task["assignees"][number] => u !== null),
    tags: task_tags.map((t) => t.tag).sort(),
    subtasks: [...task_subtasks].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)),
    attachments: [...task_attachments].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

export interface TaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  subgroupId?: string | null;
  projectId?: string | null;
  subsystemId?: string | null;
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
      project_id: input.projectId ?? null,
      subsystem_id: input.subsystemId ?? null,
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
  if (input.projectId !== undefined) patch.project_id = input.projectId;
  if (input.subsystemId !== undefined) patch.subsystem_id = input.subsystemId;
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

export async function addSubtask(supabase: Client, taskId: string, title: string, position: number) {
  const { data, error } = await supabase
    .from("task_subtasks")
    .insert({ task_id: taskId, title: title.trim(), position })
    .select("id, title, done, position")
    .single();
  if (error) throw new Error(`Could not add subtask: ${error.message}`);
  return data;
}

export async function setSubtaskDone(supabase: Client, subtaskId: string, done: boolean) {
  const { error } = await supabase.from("task_subtasks").update({ done }).eq("id", subtaskId);
  if (error) throw new Error(`Could not update subtask: ${error.message}`);
}

export async function deleteSubtask(supabase: Client, subtaskId: string) {
  const { error } = await supabase.from("task_subtasks").delete().eq("id", subtaskId);
  if (error) throw new Error(`Could not delete subtask: ${error.message}`);
}

export async function listProjects(supabase: Client): Promise<ProjectRow[]> {
  const { data, error } = await supabase.from("projects").select("*").order("name");
  if (error) throw new Error(`Could not load projects: ${error.message}`);
  return data;
}

export async function createProject(supabase: Client, userId: string, name: string): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from("projects")
    .insert({ name: name.trim(), created_by: userId })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error(`Project "${name}" already exists`);
    throw new Error(`Could not create project: ${error.message}`);
  }
  return data;
}

export async function listSubgroups(supabase: Client): Promise<SubgroupRow[]> {
  const { data, error } = await supabase.from("subgroups").select("*").order("name");
  if (error) throw new Error(`Could not load subgroups: ${error.message}`);
  return data;
}

export async function updateSubgroup(
  supabase: Client,
  id: string,
  patch: { name?: string; color?: string },
): Promise<void> {
  const clean = {
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.color !== undefined ? { color: patch.color } : {}),
  };
  const { error } = await supabase.from("subgroups").update(clean).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error(`Subgroup "${patch.name}" already exists`);
    throw new Error(`Could not update subgroup: ${error.message}`);
  }
}

/** Tasks keep existing but lose the subgroup (FK is on delete set null). */
export async function deleteSubgroup(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from("subgroups").delete().eq("id", id);
  if (error) throw new Error(`Could not delete subgroup: ${error.message}`);
}

/** subgroup id → number of tasks in it (for the admin page). */
export async function countTasksBySubgroup(supabase: Client): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("tasks").select("subgroup_id");
  if (error) throw new Error(`Could not count tasks: ${error.message}`);
  const counts: Record<string, number> = {};
  for (const row of data) {
    if (row.subgroup_id) counts[row.subgroup_id] = (counts[row.subgroup_id] ?? 0) + 1;
  }
  return counts;
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
