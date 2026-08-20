"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as tasks from "@/services/tasks.service";
import type { TaskInput } from "@/services/tasks.service";
import * as taskComments from "@/services/task-comments.service";
import * as attachments from "@/services/task-attachments.service";
import { getDownloadUrl, getFileUrl } from "@/services/storage.service";
import { notifyUsers } from "@/services/notify.service";
import { commentPreview, mentionedUserIds } from "@/lib/mentions";
import { TASK_STATUSES } from "@/types/task";

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
  await notifyAssigned(supabase, added, user.id, task.id, task.title);
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
  const before = input.status !== undefined ? await tasks.getTask(supabase, taskId) : null;
  await tasks.updateTask(supabase, taskId, input);
  if (assigneeIds) {
    const added = await tasks.setAssignees(supabase, taskId, assigneeIds);
    const task = await tasks.getTask(supabase, taskId);
    await notifyAssigned(supabase, added, user.id, taskId, task?.title ?? "A task");
  }
  if (tags) await tasks.setTags(supabase, taskId, tags);

  // the creator follows status changes on their task; only "done" also pushes
  if (before && input.status && input.status !== before.status && before.created_by) {
    const label = TASK_STATUSES.find((s) => s.value === input.status)?.label ?? input.status;
    await notifyUsers(supabase, [before.created_by], {
      kind: "task_update",
      title: input.status === "done" ? "Task finished" : "Task updated",
      body:
        input.status === "done"
          ? `"${before.title}" is done`
          : `"${before.title}" moved to ${label}`,
      url: `/tasks?task=${taskId}`,
      actorId: user.id,
      push: input.status === "done",
    });
  }
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

export async function updateSubgroupAction(id: string, patch: { name?: string; color?: string }) {
  const { supabase } = await requireUser();
  await tasks.updateSubgroup(supabase, id, patch);
  revalidate();
  revalidatePath("/subgroups");
}

export async function deleteSubgroupAction(id: string) {
  const { supabase } = await requireUser();
  await tasks.deleteSubgroup(supabase, id);
  revalidate();
  revalidatePath("/subgroups");
}

export async function addTaskCommentAction(taskId: string, body: string, taskTitle: string) {
  const { supabase, user } = await requireUser();
  const comment = await taskComments.createTaskComment(supabase, user.id, taskId, body);

  await notifyUsers(supabase, mentionedUserIds(body), {
    kind: "mention",
    title: `Mentioned on ${taskTitle}`,
    body: `${comment.author?.display_name ?? "Someone"}: ${commentPreview(body)}`,
    url: `/tasks?task=${taskId}`,
    actorId: user.id,
  });
  return comment;
}

export async function deleteTaskCommentAction(commentId: string) {
  const { supabase } = await requireUser();
  await taskComments.deleteTaskComment(supabase, commentId);
}

export async function addTaskAttachmentAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const taskId = formData.get("taskId");
  const file = formData.get("file");
  if (typeof taskId !== "string" || !(file instanceof File) || file.size === 0)
    throw new Error("A file is required");
  const attachment = await attachments.addAttachment(supabase, user.id, taskId, file);
  revalidate();
  return attachment;
}

export async function deleteTaskAttachmentAction(attachmentId: string) {
  const { supabase } = await requireUser();
  await attachments.deleteAttachment(supabase, attachmentId);
  revalidate();
}

/** Signed view + forced-download URLs for one attachment. */
export async function attachmentUrlsAction(attachmentId: string) {
  const { supabase } = await requireUser();
  const attachment = await attachments.getAttachment(supabase, attachmentId);
  const [viewUrl, downloadUrl] = await Promise.all([
    getFileUrl(supabase, attachment.path),
    getDownloadUrl(supabase, attachment.path, attachment.file_name),
  ]);
  return { viewUrl, downloadUrl };
}

async function notifyAssigned(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  addedIds: string[],
  actorId: string,
  taskId: string,
  title: string,
) {
  await notifyUsers(supabase, addedIds, {
    kind: "task_assigned",
    title: "Task assigned to you",
    body: title,
    url: `/tasks?task=${taskId}`,
    actorId,
  });
}
