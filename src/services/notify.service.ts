import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { insertNotifications, type NotificationInput } from "./inbox.service";
import { sendPush } from "./notifications.service";

type Client = SupabaseClient<Database>;

/**
 * The one entry point for "tell these people something happened":
 * writes inbox rows and (optionally) sends the matching web push.
 * The actor is always filtered out — you never notify yourself.
 */
export async function notifyUsers(
  supabase: Client,
  userIds: string[],
  input: NotificationInput & { push?: boolean },
): Promise<void> {
  const targets = [...new Set(userIds)].filter((id) => id && id !== input.actorId);
  if (targets.length === 0) return;

  await insertNotifications(supabase, targets, input);
  if (input.push !== false) {
    await sendPush(targets, { title: input.title, body: input.body, url: input.url });
  }
}
