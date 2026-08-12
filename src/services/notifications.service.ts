import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PushPayload {
  title: string;
  body: string;
  /** path to open when tapped, e.g. /parts/123 */
  url: string;
}

let configured = false;

function ensureConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:team@bearparts.app", pub, priv);
    configured = true;
  }
  return true;
}

/**
 * Send a push to specific users, or to everyone when userIds is null.
 * Dead subscriptions (410/404) are pruned. Failures never throw — parts flow
 * must not break because a phone was offline.
 */
export async function sendPush(userIds: string[] | null, payload: PushPayload, excludeUserId?: string) {
  if (!ensureConfigured()) return;
  const admin = createAdminClient();

  let query = admin.from("push_subscriptions").select("*");
  if (userIds) query = query.in("user_id", userIds);
  if (excludeUserId) query = query.neq("user_id", excludeUserId);
  const { data: subs } = await query;
  if (!subs?.length) return;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }),
  );
}
