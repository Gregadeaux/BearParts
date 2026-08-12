import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ProfileRow } from "@/types/part";

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
