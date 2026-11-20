import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ProfileRow } from "@/types/part";
import type { Role } from "@/types/role";

type Client = SupabaseClient<Database>;

export async function listProfiles(supabase: Client): Promise<ProfileRow[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("display_name");
  if (error) throw new Error(`Could not load team: ${error.message}`);
  return data;
}

export async function getProfile(supabase: Client, id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load profile: ${error.message}`);
  return data;
}

/**
 * Change a teammate's role. The DB enforces admin-only + "at least one admin"
 * (profiles_guard_role trigger); RLS hides other rows from non-admins, which
 * surfaces here as "not found".
 */
export async function setRole(supabase: Client, userId: string, role: Role): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id");
  if (error) throw new Error(`Could not change role: ${error.message}`);
  if (data.length === 0) throw new Error("Could not change role: user not found");
}
