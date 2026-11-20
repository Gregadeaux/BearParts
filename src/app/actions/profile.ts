"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/guards";

/** Own display name / experimental flag only — role changes go through setUserRoleAction. */
export async function updateProfileAction(input: {
  displayName?: string;
  experimentalFeatures?: boolean;
}) {
  const { supabase, user } = await requireUser();

  const patch: { display_name?: string; experimental_features?: boolean } = {};
  if (input.displayName !== undefined) {
    const name = input.displayName.trim();
    if (!name) throw new Error("Display name can't be empty");
    patch.display_name = name;
  }
  if (input.experimentalFeatures !== undefined) {
    patch.experimental_features = input.experimentalFeatures;
  }
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) throw new Error(`Could not update profile: ${error.message}`);
  revalidatePath("/profile");
}
