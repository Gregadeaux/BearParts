"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as partsService from "@/services/parts.service";
import * as storageService from "@/services/storage.service";
import { sendPush } from "@/services/notifications.service";
import { notifyUsers } from "@/services/notify.service";
import type { NewPartInput } from "@/services/parts.service";
import { PART_STATUSES, type PartStatus } from "@/types/part";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

export async function createPartAction(input: NewPartInput) {
  const { supabase, user } = await requireUser();
  const part = await partsService.createPart(supabase, user.id, input);

  const submitter = part.submitter?.display_name ?? "Someone";
  if (part.assigned_to) {
    await notifyUsers(supabase, [part.assigned_to], {
      kind: "part_assigned",
      title: "Part assigned to you",
      body: `${submitter} assigned "${part.name}" to you`,
      url: `/parts/${part.id}`,
      actorId: user.id,
    });
  } else {
    await sendPush(
      null,
      {
        title: "New part in queue",
        body: `${submitter} queued "${part.name}"`,
        url: `/parts/${part.id}`,
      },
      user.id,
    );
  }

  revalidatePath("/");
  revalidatePath("/board");
  return { id: part.id };
}

export async function assignPartAction(partId: string, userId: string | null) {
  const { supabase, user } = await requireUser();
  await partsService.assignPart(supabase, partId, userId);

  if (userId && userId !== user.id) {
    const part = await partsService.getPart(supabase, partId);
    await notifyUsers(supabase, [userId], {
      kind: "part_assigned",
      title: "Part assigned to you",
      body: `"${part?.name ?? "A part"}" is now yours`,
      url: `/parts/${partId}`,
      actorId: user.id,
    });
  }
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath(`/parts/${partId}`);
}

export async function updateStatusAction(partId: string, status: PartStatus) {
  const { supabase, user } = await requireUser();
  await partsService.updateStatus(supabase, partId, status);

  // the submitter follows their part's progress; only "done" also pushes
  const part = await partsService.getPart(supabase, partId);
  if (part) {
    const label = PART_STATUSES.find((s) => s.value === status)?.label ?? status;
    await notifyUsers(supabase, [part.submitted_by], {
      kind: "part_update",
      title: status === "done" ? "Part finished" : "Part updated",
      body: status === "done" ? `"${part.name}" is done` : `"${part.name}" moved to ${label}`,
      url: `/parts/${partId}`,
      actorId: user.id,
      push: status === "done",
    });
  }
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath(`/parts/${partId}`);
}

export async function setArchivedAction(partId: string, archived: boolean) {
  const { supabase } = await requireUser();
  await partsService.setArchived(supabase, partId, archived);
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath(`/parts/${partId}`);
}

export async function deletePartAction(partId: string) {
  const { supabase } = await requireUser();
  const part = await partsService.getPart(supabase, partId);
  await partsService.deletePart(supabase, partId);
  // library-sourced entries share the version's file â€” never delete those from storage
  if (part?.file_path && !part.source_version_id) {
    await storageService.deletePartFile(supabase, part.file_path);
  }
  revalidatePath("/");
  revalidatePath("/board");
}

