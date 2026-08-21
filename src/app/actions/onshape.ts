"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { disconnect } from "@/services/onshape/oauth";

export async function disconnectOnshapeAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  await disconnect(supabase, user.id);
  revalidatePath("/integrations");
}
