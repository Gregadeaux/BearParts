"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/guards";
import { setRole } from "@/services/profiles.service";
import { isRole, type Role } from "@/types/role";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SetUserRoleResult = { ok: true } | { ok: false; error: string };

/**
 * Admin-only role change. RLS + the profiles_guard_role trigger enforce it again.
 * Expected failures come back as `{ ok: false, error }` instead of throwing, because
 * production builds mask thrown server-action messages (and the last-admin message
 * is one a real admin will hit).
 */
export async function setUserRoleAction(userId: string, role: Role): Promise<SetUserRoleResult> {
  let supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"];
  try {
    ({ supabase } = await requireAdmin());
  } catch (e) {
    return { ok: false, error: messageOf(e, "Only admins can do that") };
  }
  if (typeof userId !== "string" || !UUID.test(userId)) return { ok: false, error: "Unknown user" };
  if (!isRole(role)) return { ok: false, error: "Unknown role" };

  try {
    await setRole(supabase, userId, role);
  } catch (e) {
    const message = messageOf(e, "Could not change role");
    if (message.includes("at least one admin")) {
      return { ok: false, error: "There must be at least one admin. Promote someone else first." };
    }
    if (message.includes("Only admins")) return { ok: false, error: "Only admins can do that" };
    return { ok: false, error: message };
  }
  revalidatePath("/users");
  return { ok: true };
}

function messageOf(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
