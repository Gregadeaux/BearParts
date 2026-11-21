"use server";

import { revalidatePath } from "next/cache";
import { requireLead, requireUser } from "@/lib/supabase/guards";
import * as partsService from "@/services/parts.service";
import * as storageService from "@/services/storage.service";
import { sendPush } from "@/services/notifications.service";
import { notifyUsers } from "@/services/notify.service";
import type { NewPartInput } from "@/services/parts.service";
import { parseThicknessIn } from "@/services/dimensions/thickness";
import { asModelSizeCache, type ModelSizeCache } from "@/services/dimensions/model-size";
import { methodMeta, PART_STATUSES, type PartMethod, type PartStatus } from "@/types/part";

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

export async function updateMethodAction(partId: string, method: PartMethod) {
  const { supabase } = await requireUser();
  await partsService.updateMethod(supabase, partId, method, methodMeta(method).lanes);
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath(`/parts/${partId}`);
}

/** Stock thickness (inches) — anyone can set or clear it. */
export async function updateThicknessAction(partId: string, thicknessIn: number | null) {
  const { supabase } = await requireUser();
  const value = thicknessIn === null ? null : parseThicknessIn(thicknessIn);
  if (thicknessIn !== null && value === null) throw new Error("Thickness must be 0–24 in");
  await partsService.updateThickness(supabase, partId, value);
  revalidatePath(`/parts/${partId}`);
}

/**
 * Cache a STEP/STL box (+ STEP hole groups) computed client-side the first
 * time Verify opens. Validated and trimmed server-side. No revalidate: the
 * open flow already holds the value, and re-rendering mid-check buys nothing.
 */
export async function cacheModelSizeAction(partId: string, cache: ModelSizeCache) {
  const { supabase } = await requireUser();
  const clean = asModelSizeCache(cache);
  if (!clean) throw new Error("Invalid model size");
  await partsService.cacheModelSize(supabase, partId, clean);
}

/** Archive and restore are both lead-only (DB trigger enforces it too). */
export async function setArchivedAction(partId: string, archived: boolean) {
  const { supabase } = await requireLead();
  await partsService.setArchived(supabase, partId, archived);
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath(`/parts/${partId}`);
}

export async function deletePartAction(partId: string) {
  const { supabase } = await requireLead();
  const part = await partsService.getPart(supabase, partId);
  await partsService.deletePart(supabase, partId);
  // library-sourced entries share the version's file â€” never delete those from storage
  if (part && !part.source_version_id) {
    const paths = [part.file_path, part.thumb_path].filter((p): p is string => Boolean(p));
    await storageService.deleteFiles(supabase, paths);
  }
  revalidatePath("/");
  revalidatePath("/board");
}

