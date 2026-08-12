import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Part, PartPriority, PartStatus } from "@/types/part";
import type { DxfAnalysis, Units } from "@/types/analysis";

type Client = SupabaseClient<Database>;

const PART_SELECT = `*,
  submitter:profiles!parts_submitted_by_fkey (id, display_name, avatar_url),
  assignee:profiles!parts_assigned_to_fkey (id, display_name, avatar_url)`;

export interface NewPartInput {
  name: string;
  description?: string;
  material?: string;
  quantity: number;
  priority: PartPriority;
  assignedTo?: string | null;
  dxfPath: string;
  units: Units;
  analysis: DxfAnalysis;
}

export async function listParts(
  supabase: Client,
  filter?: { status?: PartStatus[]; assignedTo?: string },
): Promise<Part[]> {
  let query = supabase.from("parts").select(PART_SELECT).order("created_at", { ascending: false });
  if (filter?.status?.length) query = query.in("status", filter.status);
  if (filter?.assignedTo) query = query.eq("assigned_to", filter.assignedTo);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load parts: ${error.message}`);
  return data as unknown as Part[];
}

export async function getPart(supabase: Client, id: string): Promise<Part | null> {
  const { data, error } = await supabase.from("parts").select(PART_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load part: ${error.message}`);
  return data as unknown as Part | null;
}

export async function createPart(supabase: Client, userId: string, input: NewPartInput): Promise<Part> {
  const { data, error } = await supabase
    .from("parts")
    .insert({
      name: input.name,
      description: input.description || null,
      material: input.material || null,
      quantity: input.quantity,
      priority: input.priority,
      status: input.assignedTo ? "assigned" : "queued",
      submitted_by: userId,
      assigned_to: input.assignedTo ?? null,
      dxf_path: input.dxfPath,
      units: input.units,
      analysis: input.analysis as never,
    })
    .select(PART_SELECT)
    .single();
  if (error) throw new Error(`Could not create part: ${error.message}`);
  return data as unknown as Part;
}

export async function updateStatus(supabase: Client, id: string, status: PartStatus) {
  const { error } = await supabase.from("parts").update({ status }).eq("id", id);
  if (error) throw new Error(`Could not update status: ${error.message}`);
}

/** Assign (or unassign with null). Keeps status in sync when leaving/entering the queue. */
export async function assignPart(supabase: Client, id: string, userId: string | null) {
  const { error } = await supabase
    .from("parts")
    .update({ assigned_to: userId, status: userId ? "assigned" : "queued" })
    .eq("id", id);
  if (error) throw new Error(`Could not assign part: ${error.message}`);
}

export async function deletePart(supabase: Client, id: string) {
  const { error } = await supabase.from("parts").delete().eq("id", id);
  if (error) throw new Error(`Could not delete part: ${error.message}`);
}
