"use server";

import { createClient } from "@/lib/supabase/server";
import { markAllRead, markRead } from "@/services/inbox.service";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

export async function markNotificationReadAction(id: string) {
  const { supabase } = await requireUser();
  await markRead(supabase, id);
}

export async function markAllNotificationsReadAction() {
  const { supabase } = await requireUser();
  await markAllRead(supabase);
}
