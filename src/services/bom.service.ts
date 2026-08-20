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

/** Vendors on Shopify — their storefront JSON powers SKU auto-fill. */
export const SHOPIFY_VENDORS: ReadonlySet<BomVendor> = new Set([
  "wcp",
  "ttb",
  "ctre",
  "andymark",
]);

/** Vendor storefronts, for mentors placing orders. */
export const VENDOR_URLS: Partial<Record<BomVendor, string>> = {
  wcp: "https://wcproducts.com",
  ttb: "https://www.thethriftybot.com",
  rev: "https://www.revrobotics.com",
  ctre: "https://store.ctr-electronics.com",
  andymark: "https://www.andymark.com",
  vex: "https://www.vexrobotics.com",
  mcmaster: "https://www.mcmaster.com",
};

export interface BomItemInput {
  vendor: BomVendor;
  name: string;
  libraryPartId?: string | null;
  sku?: string | null;
  url?: string | null;
  quantity: number;
  unitPrice?: number | null;
  imageUrl?: string | null;
}

/** How many an order-list row represents — order_quantity wins when set. */
export function orderQty(item: Pick<BomItemRow, "quantity" | "order_quantity">): number {
  return item.order_quantity ?? item.quantity;
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
      image_url: input.imageUrl ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`Could not add BOM item: ${error.message}`);
  return data;
}

export interface OrderItem extends BomItemRow {
  subsystem: { id: string; name: string } | null;
}

/** Everything on the order list (to_order) or in flight (ordered), across subsystems. */
export async function listOrderItems(supabase: Client): Promise<OrderItem[]> {
  const { data, error } = await supabase
    .from("bom_items")
    .select("*, subsystem:subsystems (id, name)")
    .in("status", ["to_order", "ordered"])
    .order("vendor")
    .order("name");
  if (error) throw new Error(`Could not load order list: ${error.message}`);
  return data as unknown as OrderItem[];
}

/** Bulk status flip — e.g. "mark this vendor's items ordered". */
export async function setBomItemsStatus(
  supabase: Client,
  ids: string[],
  status: BomStatus,
): Promise<void> {
  if (ids.length === 0) return;
  // back to planned means the order intent is gone
  const patch = status === "planned" ? { status, order_quantity: null } : { status };
  const { error } = await supabase.from("bom_items").update(patch).in("id", ids);
  if (error) throw new Error(`Could not update items: ${error.message}`);
}

export async function getBomItems(supabase: Client, ids: string[]): Promise<BomItemRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("bom_items").select("*").in("id", ids);
  if (error) throw new Error(`Could not load items: ${error.message}`);
  return data;
}

export interface BomItemPatch {
  quantity?: number;
  status?: BomStatus;
  orderQuantity?: number | null;
}

export async function updateBomItem(
  supabase: Client,
  id: string,
  patch: BomItemPatch,
): Promise<void> {
  const row: Database["public"]["Tables"]["bom_items"]["Update"] = {};
  if (patch.quantity !== undefined) row.quantity = patch.quantity;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.orderQuantity !== undefined) row.order_quantity = patch.orderQuantity;
  const { error } = await supabase.from("bom_items").update(row).eq("id", id);
  if (error) throw new Error(`Could not update BOM item: ${error.message}`);
}

export async function deleteBomItem(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from("bom_items").delete().eq("id", id);
  if (error) throw new Error(`Could not delete BOM item: ${error.message}`);
}
