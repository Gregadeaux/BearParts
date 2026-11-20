import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { asRole, canDestroy, canManageUsers, type Role } from "@/types/role";

/*
 * Auth/role guards for server actions and server components. Deliberately
 * NOT a server-actions module — plain server-only helpers, never callable
 * from the client. RLS + triggers (0027_roles.sql) are the real enforcement;
 * these fail fast with a readable message.
 */

type ServerClient = Awaited<ReturnType<typeof createClient>>;

async function roleOf(supabase: ServerClient, userId: string): Promise<Role> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not load role: ${error.message}`);
  return asRole(data?.role);
}

/** Cookie-bound client + signed-in user, or throws. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

/** Leads and admins only — use for every destructive action (delete, archive). */
export async function requireLead() {
  const { supabase, user } = await requireUser();
  const role = await roleOf(supabase, user.id);
  if (!canDestroy(role)) throw new Error("Only leads and admins can do that");
  return { supabase, user, role };
}

/** Admins only — role management. */
export async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const role = await roleOf(supabase, user.id);
  if (!canManageUsers(role)) throw new Error("Only admins can do that");
  return { supabase, user, role };
}

/**
 * The signed-in viewer's id + role for rendering (layout, pages). Deduped per
 * request; null when signed out. Never throws — a failed role lookup falls
 * back to the least-privileged role.
 */
export const getViewer = cache(async (): Promise<{ userId: string; role: Role } | null> => {
  let supabase: ServerClient;
  let userId: string;
  try {
    supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    userId = user.id;
  } catch {
    return null;
  }
  try {
    return { userId, role: await roleOf(supabase, userId) };
  } catch {
    return { userId, role: "student" };
  }
});
