import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type BomItemRow = Database["public"]["Tables"]["bom_items"]["Row"];

export type BomVendor =
  | "custom"
  | "wcp"
  | "ttb"
  | "rev"
  | "ctre"
  | "andymark"
  | "vex"
  | "mcmaster";

export type BomStatus = "planned" | "to_order" | "ordered" | "received";

export const BOM_VENDORS: { value: BomVendor; label: string }[] = [
  { value: "custom", label: "Custom (ours)" },
  { value: "wcp", label: "WCP" },
  { value: "ttb", label: "The Thrifty Bot" },
  { value: "rev", label: "REV Robotics" },
  { value: "ctre", label: "CTR Electronics" },
  { value: "andymark", label: "AndyMark" },
  { value: "vex", label: "VEX" },
  { value: "mcmaster", label: "McMaster-Carr" },
];

export const BOM_STATUSES: { value: BomStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "to_order", label: "To order" },
  { value: "ordered", label: "Ordered" },
  { value: "received", label: "Received" },
];

export interface BomItemInput {
  vendor: BomVendor;
  name: string;
  libraryPartId?: string | null;
  sku?: string | null;
  url?: string | null;
  quantity: number;
  unitPrice?: number | null;
}

export async function listBomItems(supabase: Client, subsystemId: string): Promise<BomItemRow[]> {
  const { data, error } = await supabase
    .from("bom_items")
    .select("*")
    .eq("subsystem_id", subsystemId)
    .order("created_at");
  if (error) throw new Error(`Could not load BOM: ${error.message}`);
  return data;
}

export async function createBomItem(
  supabase: Client,
  userId: string,
  subsystemId: string,
  input: BomItemInput,
): Promise<BomItemRow> {
  const { data, error } = await supabase
    .from("bom_items")
    .insert({
      subsystem_id: subsystemId,
      vendor: input.vendor,
      library_part_id: input.vendor === "custom" ? (input.libraryPartId ?? null) : null,
      name: input.name.trim(),
      sku: input.sku?.trim() || null,
      url: input.url?.trim() || null,
      quantity: input.quantity,
      unit_price: input.unitPrice ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`Could not add BOM item: ${error.message}`);
  return data;
}

export async function updateBomItem(
  supabase: Client,
  id: string,
  patch: { quantity?: number; status?: BomStatus },
): Promise<void> {
  const { error } = await supabase.from("bom_items").update(patch).eq("id", id);
  if (error) throw new Error(`Could not update BOM item: ${error.message}`);
}

export async function deleteBomItem(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from("bom_items").delete().eq("id", id);
  if (error) throw new Error(`Could not delete BOM item: ${error.message}`);
}
