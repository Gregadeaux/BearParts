"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as subsystems from "@/services/subsystems.service";
import * as comments from "@/services/subsystem-comments.service";
import * as bom from "@/services/bom.service";
import { SHOPIFY_VENDORS, VENDOR_URLS } from "@/services/bom.service";
import type { BomItemInput, BomStatus, BomVendor } from "@/services/bom.service";
import { lookupShopifyProduct } from "@/services/shopify.service";
import { notifyUsers } from "@/services/notify.service";
import { commentPreview, mentionedUserIds } from "@/lib/mentions";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

export async function createSubsystemAction(input: {
  name: string;
  projectId: string;
  folderId: string;
}) {
  const { supabase, user } = await requireUser();
  const subsystem = await subsystems.createSubsystem(supabase, user.id, input);
  revalidatePath("/library");
  return subsystem;
}

export async function deleteSubsystemAction(id: string) {
  const { supabase } = await requireUser();
  await subsystems.deleteSubsystem(supabase, id);
  revalidatePath("/library");
}

export async function addSubsystemCommentAction(
  subsystemId: string,
  body: string,
  subsystemName: string,
) {
  const { supabase, user } = await requireUser();
  const comment = await comments.createSubsystemComment(supabase, user.id, subsystemId, body);

  await notifyUsers(supabase, mentionedUserIds(body), {
    kind: "mention",
    title: `Mentioned on ${subsystemName}`,
    body: `${comment.author?.display_name ?? "Someone"}: ${commentPreview(body)}`,
    url: `/subsystems/${subsystemId}`,
    actorId: user.id,
  });
  return comment;
}

export async function deleteSubsystemCommentAction(commentId: string) {
  const { supabase } = await requireUser();
  await comments.deleteSubsystemComment(supabase, commentId);
}

export async function addBomItemAction(subsystemId: string, input: BomItemInput) {
  const { supabase, user } = await requireUser();
  const item = await bom.createBomItem(supabase, user.id, subsystemId, input);
  revalidatePath(`/subsystems/${subsystemId}`);
  return item;
}

export async function updateBomItemAction(
  id: string,
  patch: { quantity?: number; status?: BomStatus },
) {
  const { supabase } = await requireUser();
  await bom.updateBomItem(supabase, id, patch);
  revalidatePath("/orders");
}

export async function setBomStatusAction(ids: string[], status: BomStatus) {
  const { supabase } = await requireUser();
  await bom.setBomItemsStatus(supabase, ids, status);
  revalidatePath("/orders");
}

export async function deleteBomItemAction(id: string) {
  const { supabase } = await requireUser();
  await bom.deleteBomItem(supabase, id);
}

/** Auto-fill a COTS item from the vendor's public Shopify storefront. */
export async function lookupBomProductAction(vendor: BomVendor, query: string) {
  await requireUser();
  const base = VENDOR_URLS[vendor];
  if (!base || !SHOPIFY_VENDORS.has(vendor)) throw new Error("No auto-fill for this vendor");
  try {
    const result = await lookupShopifyProduct(base, query);
    if (!result) throw new Error("not found");
    return result;
  } catch {
    throw new Error(`Couldn't find "${query}" at ${base.replace("https://", "")}`);
  }
}
