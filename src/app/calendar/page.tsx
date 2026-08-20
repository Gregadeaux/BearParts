import { createClient } from "@/lib/supabase/server";
import { getProfile, listProfiles } from "@/services/profiles.service";
import { listAllTags, listProjects, listSubgroups, listTasks } from "@/services/tasks.service";
import { listMilestones } from "@/services/milestones.service";
import { listSubsystems } from "@/services/subsystems.service";
import { AppShell } from "@/components/layout/app-shell";
import { CalendarView } from "@/components/calendar/calendar-view";
import { toDayKey } from "@/components/calendar/calendar-layout";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, team, tasks, milestones, subgroups, projects, subsystems, allTags] =
    await Promise.all([
      getProfile(supabase, user.id),
      listProfiles(supabase),
      listTasks(supabase),
      listMilestones(supabase),
      listSubgroups(supabase),
      listProjects(supabase),
      listSubsystems(supabase),
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
          initialMilestones={milestones}
          subgroups={subgroups}
          team={team}
          projects={projects}
          subsystems={subsystems}
          allTags={allTags}
          userId={user.id}
          initialToday={toDayKey(new Date())}
        />
      </main>
    </AppShell>
  );
}
