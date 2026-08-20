import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/services/profiles.service";
import { listNotifications } from "@/services/inbox.service";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationsList } from "@/components/notifications/notifications-list";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, notifications] = await Promise.all([
    getProfile(supabase, user.id),
    listNotifications(supabase),
  ]);

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title="Notifications"
    >
      <main className="p-4">
        <NotificationsList initial={notifications} />
      </main>
    </AppShell>
  );
}
