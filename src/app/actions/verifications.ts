"use server";

import { revalidatePath } from "next/cache";
import { requireLead, requireUser } from "@/lib/supabase/guards";
import * as partsService from "@/services/parts.service";
import * as verifications from "@/services/verifications.service";
import { notifyUsers } from "@/services/notify.service";
import { overallResult, sanitizeMeasurements } from "@/services/dimensions/verification";
import type { VerificationResult } from "@/types/verification";

/**
 * Record a check. Measurements are re-graded server-side so the stored
 * pass/fail always matches the numbers. A FAIL tells the submitter (push too).
 */
export async function createVerificationAction(
  partId: string,
  dimensions: unknown,
  note?: string | null,
): Promise<{ id: string; result: VerificationResult }> {
  const { supabase, user } = await requireUser();
  const graded = sanitizeMeasurements(dimensions);
  const result = overallResult(graded);
  const saved = await verifications.createVerification(supabase, user.id, {
    partId,
    dimensions: graded,
    result,
    note: typeof note === "string" ? note : null,
  });

  if (result === "fail") {
    const part = await partsService.getPart(supabase, partId);
    if (part) {
      const misses = graded.filter((d) => d.pass === false).length;
      await notifyUsers(supabase, [part.submitted_by], {
        kind: "part_check_failed",
        title: "Part failed check",
        body: `"${part.name}" — ${misses} dimension${misses === 1 ? "" : "s"} out of tolerance`,
        url: `/parts/${partId}`,
        actorId: user.id,
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath(`/parts/${partId}`);
  return { id: saved.id, result };
}

/** Records are immutable; only leads/admins may remove one. */
export async function deleteVerificationAction(verificationId: string) {
  const { supabase } = await requireLead();
  const partId = await verifications.deleteVerification(supabase, verificationId);
  revalidatePath("/");
  revalidatePath("/board");
  if (partId) revalidatePath(`/parts/${partId}`);
}
