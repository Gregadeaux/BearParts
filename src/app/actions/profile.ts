"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfileAction(input: {
  displayName?: string;
  experimentalFeatures?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

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
