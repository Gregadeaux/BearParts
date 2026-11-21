import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { MeasuredDimension, PartVerification, VerificationResult } from "@/types/verification";

type Client = SupabaseClient<Database>;

const VERIFICATION_SELECT = `*,
  verifier:profiles!part_verifications_verified_by_fkey (id, display_name, avatar_url)`;

/** Every check on a part, newest first. */
export async function listVerifications(supabase: Client, partId: string): Promise<PartVerification[]> {
  const { data, error } = await supabase
    .from("part_verifications")
    .select(VERIFICATION_SELECT)
    .eq("part_id", partId)
    .order("created_at", { ascending: false });
  // table not migrated yet (0028) — the part page still renders, just without history
  if (error && (error.code === "PGRST205" || error.code === "42P01")) return [];
  if (error) throw new Error(`Could not load checks: ${error.message}`);
  return data as unknown as PartVerification[];
}

export interface NewVerificationInput {
  partId: string;
  /** already validated + graded (sanitizeMeasurements) */
  dimensions: MeasuredDimension[];
  result: VerificationResult;
  note?: string | null;
}

/** Records are immutable once written — there is no update. */
export async function createVerification(
  supabase: Client,
  userId: string,
  input: NewVerificationInput,
): Promise<PartVerification> {
  const { data, error } = await supabase
    .from("part_verifications")
    .insert({
      part_id: input.partId,
      verified_by: userId,
      result: input.result,
      dimensions: input.dimensions as never,
      note: input.note?.trim().slice(0, 500) || null,
    })
    .select(VERIFICATION_SELECT)
    .single();
  if (error) throw new Error(`Could not save check: ${error.message}`);
  return data as unknown as PartVerification;
}

/** Lead/admin only (RLS). Returns the part id so callers can revalidate. */
export async function deleteVerification(supabase: Client, id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("part_verifications")
    .delete()
    .eq("id", id)
    .select("part_id")
    .maybeSingle();
  if (error) throw new Error(`Could not delete check: ${error.message}`);
  if (!data) throw new Error("Check not found (or not yours to delete)");
  return data.part_id;
}
