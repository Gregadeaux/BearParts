"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as subsystems from "@/services/subsystems.service";
import * as comments from "@/services/subsystem-comments.service";
import * as bom from "@/services/bom.service";
import type { BomItemInput, BomStatus } from "@/services/bom.service";
import { notifyUsers } from "@/services/notify.service";
import { commentPreview, mentionedUserIds } from "@/lib/mentions";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

export async function createSubsystemAction(input: {
  name: string;
  projectId: string;
  folderId: string;
}) {
  const { supabase, user } = await requireUser();
  const subsystem = await subsystems.createSubsystem(supabase, user.id, input);
  revalidatePath("/library");
  return subsystem;
}

export async function deleteSubsystemAction(id: string) {
  const { supabase } = await requireUser();
  await subsystems.deleteSubsystem(supabase, id);
  revalidatePath("/library");
}

export async function addSubsystemCommentAction(
  subsystemId: string,
  body: string,
  subsystemName: string,
) {
  const { supabase, user } = await requireUser();
  const comment = await comments.createSubsystemComment(supabase, user.id, subsystemId, body);

  await notifyUsers(supabase, mentionedUserIds(body), {
    kind: "mention",
    title: `Mentioned on ${subsystemName}`,
    body: `${comment.author?.display_name ?? "Someone"}: ${commentPreview(body)}`,
    url: `/subsystems/${subsystemId}`,
    actorId: user.id,
  });
  return comment;
}

export async function deleteSubsystemCommentAction(commentId: string) {
  const { supabase } = await requireUser();
  await comments.deleteSubsystemComment(supabase, commentId);
}

export async function addBomItemAction(subsystemId: string, input: BomItemInput) {
  const { supabase, user } = await requireUser();
  const item = await bom.createBomItem(supabase, user.id, subsystemId, input);
  revalidatePath(`/subsystems/${subsystemId}`);
  return item;
}

export async function updateBomItemAction(
  id: string,
  patch: { quantity?: number; status?: BomStatus },
) {
  const { supabase } = await requireUser();
  await bom.updateBomItem(supabase, id, patch);
}

export async function deleteBomItemAction(id: string) {
  const { supabase } = await requireUser();
  await bom.deleteBomItem(supabase, id);
}
