import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Part, PartFileType, PartMethod, PartPriority, PartStatus } from "@/types/part";
import { defaultMethodFor } from "@/types/part";
import type { DxfAnalysis, Units } from "@/types/analysis";

type Client = SupabaseClient<Database>;

const PART_SELECT = `*,
  submitter:profiles!parts_submitted_by_fkey (id, display_name, avatar_url),
  assignee:profiles!parts_assigned_to_fkey (id, display_name, avatar_url),
  source_version:part_versions (id, version, library_part:library_parts (id, name))`;

export interface NewPartInput {
  name: string;
  description?: string;
  material?: string;
  quantity: number;
  priority: PartPriority;
  assignedTo?: string | null;
  filePath: string;
  fileType: PartFileType;
  /** DXF only — STL parts carry no analysis */
  units?: Units;
  analysis?: DxfAnalysis;
  /** set when this queue entry was created from a library version */
  sourceVersionId?: string;
  /** preview PNG storage path (shared with the source version when present) */
  thumbPath?: string | null;
  /** fabrication flow — defaults from the file type when omitted */
  method?: PartMethod;
}

export async function listParts(
  supabase: Client,
  filter?: { status?: PartStatus[]; assignedTo?: string },
): Promise<Part[]> {
  let query = supabase
    .from("parts")
    .select(PART_SELECT)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (filter?.status?.length) query = query.in("status", filter.status);
  if (filter?.assignedTo) query = query.eq("assigned_to", filter.assignedTo);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load parts: ${error.message}`);
  return data as unknown as Part[];
}

/** Archived parts, most recently archived first. */
export async function listArchivedParts(supabase: Client): Promise<Part[]> {
  const { data, error } = await supabase
    .from("parts")
    .select(PART_SELECT)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });
  if (error) throw new Error(`Could not load archive: ${error.message}`);
  return data as unknown as Part[];
}

export async function setArchived(supabase: Client, id: string, archived: boolean) {
  const { error } = await supabase
    .from("parts")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(`Could not ${archived ? "archive" : "restore"} part: ${error.message}`);
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
      status: "queued",
      method: input.method ?? defaultMethodFor(input.fileType),
      submitted_by: userId,
      assigned_to: input.assignedTo ?? null,
      file_path: input.filePath,
      file_type: input.fileType,
      units: input.units ?? "unknown",
      analysis: (input.analysis ?? null) as never,
      source_version_id: input.sourceVersionId ?? null,
      thumb_path: input.thumbPath ?? null,
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

/**
 * Assign (or unassign with null). Assignment is orthogonal to pipeline stage;
 * releasing a part (null) also puts it back in the queue lane.
 */
export async function assignPart(supabase: Client, id: string, userId: string | null) {
  const { error } = await supabase
    .from("parts")
    .update(userId ? { assigned_to: userId } : { assigned_to: null, status: "queued" })
    .eq("id", id);
  if (error) throw new Error(`Could not assign part: ${error.message}`);
}

/** Change fabrication method; stages outside the new pipeline reset to queued. */
export async function updateMethod(
  supabase: Client,
  id: string,
  method: string,
  validStatuses: string[],
) {
  const { data: current, error: readError } = await supabase
    .from("parts")
    .select("status")
    .eq("id", id)
    .single();
  if (readError) throw new Error(`Could not load part: ${readError.message}`);
  const keep = validStatuses.includes(current.status) || ["done", "rejected"].includes(current.status);
  const { error } = await supabase
    .from("parts")
    .update(keep ? { method } : { method, status: "queued" })
    .eq("id", id);
  if (error) throw new Error(`Could not change method: ${error.message}`);
}

export async function deletePart(supabase: Client, id: string) {
  const { error } = await supabase.from("parts").delete().eq("id", id);
  if (error) throw new Error(`Could not delete part: ${error.message}`);
}
