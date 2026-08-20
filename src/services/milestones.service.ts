import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type MilestoneRow = Database["public"]["Tables"]["milestones"]["Row"];

export interface MilestoneInput {
  title: string;
  date: string; // yyyy-MM-dd
  description?: string | null;
}

export async function listMilestones(supabase: Client): Promise<MilestoneRow[]> {
  const { data, error } = await supabase.from("milestones").select("*").order("date");
  if (error) throw new Error(`Could not load milestones: ${error.message}`);
  return data;
}

export async function createMilestone(
  supabase: Client,
  userId: string,
  input: MilestoneInput,
): Promise<MilestoneRow> {
  const { data, error } = await supabase
    .from("milestones")
    .insert({
      title: input.title.trim(),
      date: input.date,
      description: input.description?.trim() || null,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw new Error(`Could not create milestone: ${error.message}`);
  return data;
}

export async function updateMilestone(
  supabase: Client,
  id: string,
  input: MilestoneInput,
): Promise<void> {
  const { error } = await supabase
    .from("milestones")
    .update({
      title: input.title.trim(),
      date: input.date,
      description: input.description?.trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(`Could not update milestone: ${error.message}`);
}

export async function deleteMilestone(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from("milestones").delete().eq("id", id);
  if (error) throw new Error(`Could not delete milestone: ${error.message}`);
}
