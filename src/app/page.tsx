import { createClient } from "@/lib/supabase/server";
import { listParts } from "@/services/parts.service";
import { getProfile } from "@/services/profiles.service";
import { listTasks } from "@/services/tasks.service";
import { listMilestones } from "@/services/milestones.service";
import { listFavoriteFolders } from "@/services/folder-favorites.service";
import { AppShell } from "@/components/layout/app-shell";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { toDayKey } from "@/components/calendar/calendar-layout";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware redirects

  const [profile, parts, tasks, milestones, favorites] = await Promise.all([
    getProfile(supabase, user.id),
    listParts(supabase),
    listTasks(supabase),
    listMilestones(supabase),
    listFavoriteFolders(supabase, user.id),
  ]);

  const userName = profile?.display_name ?? "Teammate";

  return (
    <AppShell
      userName={userName}
      userAvatar={profile?.avatar_url ?? null}
      title="Home"
    >
      <main className="mx-auto max-w-6xl p-4">
        <HomeDashboard
          parts={parts}
          tasks={tasks}
          milestones={milestones}
          favorites={favorites}
          userId={user.id}
          userName={userName}
          today={toDayKey(new Date())}
        />
      </main>
    </AppShell>
  );
}
