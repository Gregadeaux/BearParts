"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as tasks from "@/services/tasks.service";
import type { TaskInput } from "@/services/tasks.service";
import { sendPush } from "@/services/notifications.service";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

function revalidate() {
  revalidatePath("/tasks");
  revalidatePath("/calendar");
}

export async function createTaskAction(input: TaskInput, assigneeIds: string[], tags: string[]) {
  const { supabase, user } = await requireUser();
  const task = await tasks.createTask(supabase, user.id, input);
  const added = await tasks.setAssignees(supabase, task.id, assigneeIds);
  await tasks.setTags(supabase, task.id, tags);
  await notifyAssigned(added, user.id, task.title);
  revalidate();
  return { id: task.id };
}

export async function updateTaskAction(
  taskId: string,
  input: Partial<TaskInput>,
  assigneeIds?: string[],
  tags?: string[],
) {
  const { supabase, user } = await requireUser();
  await tasks.updateTask(supabase, taskId, input);
  if (assigneeIds) {
    const added = await tasks.setAssignees(supabase, taskId, assigneeIds);
    const task = await tasks.getTask(supabase, taskId);
    await notifyAssigned(added, user.id, task?.title ?? "A task");
  }
  if (tags) await tasks.setTags(supabase, taskId, tags);
  revalidate();
}

export async function deleteTaskAction(taskId: string) {
  const { supabase } = await requireUser();
  await tasks.deleteTask(supabase, taskId);
  revalidate();
}

export async function addSubtaskAction(taskId: string, title: string, position: number) {
  const { supabase } = await requireUser();
  const subtask = await tasks.addSubtask(supabase, taskId, title, position);
  revalidate();
  return subtask;
}

export async function setSubtaskDoneAction(subtaskId: string, done: boolean) {
  const { supabase } = await requireUser();
  await tasks.setSubtaskDone(supabase, subtaskId, done);
  revalidate();
}

export async function deleteSubtaskAction(subtaskId: string) {
  const { supabase } = await requireUser();
  await tasks.deleteSubtask(supabase, subtaskId);
  revalidate();
}

export async function createProjectAction(name: string) {
  const { supabase, user } = await requireUser();
  const project = await tasks.createProject(supabase, user.id, name);
  revalidate();
  return project;
}

export async function createSubgroupAction(name: string, color: string) {
  const { supabase } = await requireUser();
  const subgroup = await tasks.createSubgroup(supabase, name, color);
  revalidate();
  return subgroup;
}

async function notifyAssigned(addedIds: string[], actorId: string, title: string) {
  const targets = addedIds.filter((id) => id !== actorId);
  if (targets.length === 0) return;
  await sendPush(targets, {
    title: "Task assigned to you",
    body: title,
    url: "/tasks",
  });
}
