"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as partsService from "@/services/parts.service";
import * as storageService from "@/services/storage.service";
import { sendPush } from "@/services/notifications.service";
import type { NewPartInput } from "@/services/parts.service";
import type { PartStatus } from "@/types/part";

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
    await sendPush([part.assigned_to], {
      title: "Part assigned to you",
      body: `${submitter} assigned "${part.name}" to you`,
      url: `/parts/${part.id}`,
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
  return { id: part.id };
}

export async function assignPartAction(partId: string, userId: string | null) {
  const { supabase, user } = await requireUser();
  await partsService.assignPart(supabase, partId, userId);

  if (userId && userId !== user.id) {
    const part = await partsService.getPart(supabase, partId);
    await sendPush([userId], {
      title: "Part assigned to you",
      body: `"${part?.name ?? "A part"}" is now yours`,
      url: `/parts/${partId}`,
    });
  }
  revalidatePath("/");
  revalidatePath(`/parts/${partId}`);
}

export async function updateStatusAction(partId: string, status: PartStatus) {
  const { supabase, user } = await requireUser();
  await partsService.updateStatus(supabase, partId, status);

  if (status === "done") {
    const part = await partsService.getPart(supabase, partId);
    if (part && part.submitted_by !== user.id) {
      await sendPush([part.submitted_by], {
        title: "Part finished",
        body: `"${part.name}" is done`,
        url: `/parts/${partId}`,
      });
    }
  }
  revalidatePath("/");
  revalidatePath(`/parts/${partId}`);
}

export async function deletePartAction(partId: string) {
  const { supabase } = await requireUser();
  const part = await partsService.getPart(supabase, partId);
  await partsService.deletePart(supabase, partId);
  if (part?.file_path) await storageService.deletePartFile(supabase, part.file_path);
  revalidatePath("/");
}
