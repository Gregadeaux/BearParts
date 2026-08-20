import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ProfileRow } from "@/types/part";

type Client = SupabaseClient<Database>;

export type NotificationKind =
  | "part_assigned"
  | "task_assigned"
  | "mention"
  | "part_update"
  | "task_update";

export interface AppNotification {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  url: string;
  read_at: string | null;
  created_at: string;
  actor: Pick<ProfileRow, "id" | "display_name" | "avatar_url"> | null;
}

export interface NotificationInput {
  kind: NotificationKind;
  title: string;
  body: string;
  url: string;
  actorId?: string;
}

const NOTIFICATION_SELECT = `*, actor:profiles!notifications_actor_id_fkey (id, display_name, avatar_url)`;

export async function insertNotifications(
  supabase: Client,
  userIds: string[],
  input: NotificationInput,
): Promise<void> {
  if (userIds.length === 0) return;
  const { error } = await supabase.from("notifications").insert(
    userIds.map((user_id) => ({
      user_id,
      actor_id: input.actorId ?? null,
      kind: input.kind,
      title: input.title,
      body: input.body,
      url: input.url,
    })),
  );
  if (error) throw new Error(`Could not create notifications: ${error.message}`);
}

/** Newest first, capped — the inbox page. */
export async function listNotifications(supabase: Client, limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load notifications: ${error.message}`);
  return data as unknown as AppNotification[];
}

/** RLS already scopes rows to the signed-in user. */
export async function unreadCount(supabase: Client): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw new Error(`Could not count notifications: ${error.message}`);
  return count ?? 0;
}

export async function markRead(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw new Error(`Could not mark as read: ${error.message}`);
}

export async function markAllRead(supabase: Client): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw new Error(`Could not mark all as read: ${error.message}`);
}
