import { createClient } from "@/lib/supabase/server";
import { getProfile, listProfiles } from "@/services/profiles.service";
import { listAllTags, listSubgroups, listTasks } from "@/services/tasks.service";
import { AppShell } from "@/components/layout/app-shell";
import { CalendarView } from "@/components/calendar/calendar-view";
import { toDayKey } from "@/components/calendar/calendar-layout";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, team, tasks, subgroups, allTags] = await Promise.all([
    getProfile(supabase, user.id),
    listProfiles(supabase),
    listTasks(supabase),
    listSubgroups(supabase),
    listAllTags(supabase),
  ]);

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title="Calendar"
    >
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <CalendarView
          initialTasks={tasks}
          subgroups={subgroups}
          team={team}
          allTags={allTags}
          userId={user.id}
          initialToday={toDayKey(new Date())}
        />
      </main>
    </AppShell>
  );
}
