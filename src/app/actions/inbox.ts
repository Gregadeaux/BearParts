"use server";

import { requireUser } from "@/lib/supabase/guards";
import { markAllRead, markRead } from "@/services/inbox.service";

export async function markNotificationReadAction(id: string) {
  const { supabase } = await requireUser();
  await markRead(supabase, id);
}

export async function markAllNotificationsReadAction() {
  const { supabase } = await requireUser();
  await markAllRead(supabase);
}
