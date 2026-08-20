import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/services/profiles.service";
import { countTasksBySubgroup, listSubgroups } from "@/services/tasks.service";
import { AppShell } from "@/components/layout/app-shell";
import { SubgroupManager } from "@/components/tasks/subgroup-manager";

export default async function SubgroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, subgroups, taskCounts] = await Promise.all([
    getProfile(supabase, user.id),
    listSubgroups(supabase),
    countTasksBySubgroup(supabase),
  ]);

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title="Subgroups"
    >
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Subgroups color-code tasks across the list and calendar.
        </p>
        <SubgroupManager initialSubgroups={subgroups} taskCounts={taskCounts} />
      </main>
    </AppShell>
  );
}
