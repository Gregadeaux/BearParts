"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/guards";
import { disconnect } from "@/services/onshape/oauth";

export async function disconnectOnshapeAction() {
  const { supabase, user } = await requireUser();
  await disconnect(supabase, user.id);
  revalidatePath("/integrations");
}
