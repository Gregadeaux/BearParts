"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as milestones from "@/services/milestones.service";
import type { MilestoneInput } from "@/services/milestones.service";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

export async function createMilestoneAction(input: MilestoneInput) {
  const { supabase, user } = await requireUser();
  const milestone = await milestones.createMilestone(supabase, user.id, input);
  revalidatePath("/calendar");
  return milestone;
}

export async function updateMilestoneAction(id: string, input: MilestoneInput) {
  const { supabase } = await requireUser();
  await milestones.updateMilestone(supabase, id, input);
  revalidatePath("/calendar");
}

export async function deleteMilestoneAction(id: string) {
  const { supabase } = await requireUser();
  await milestones.deleteMilestone(supabase, id);
  revalidatePath("/calendar");
}
