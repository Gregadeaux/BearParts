import { createClient } from "@/lib/supabase/server";
import { getProfile, listProfiles } from "@/services/profiles.service";
import { listAllTags, listProjects, listSubgroups, listTasks } from "@/services/tasks.service";
import { AppShell } from "@/components/layout/app-shell";
import { TasksView } from "@/components/tasks/tasks-view";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string; project?: string }>;
}) {
  const { task: openTaskId, project: projectId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, team, tasks, subgroups, projects, allTags] = await Promise.all([
    getProfile(supabase, user.id),
    listProfiles(supabase),
    listTasks(supabase),
    listSubgroups(supabase),
    listProjects(supabase),
    listAllTags(supabase),
  ]);

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title="Tasks"
    >
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <TasksView
          initialTasks={tasks}
          team={team}
          subgroups={subgroups}
          projects={projects}
          allTags={allTags}
          userId={user.id}
          openTaskId={openTaskId}
          projectId={projectId}
        />
      </main>
    </AppShell>
  );
}
