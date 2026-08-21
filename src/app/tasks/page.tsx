import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, listProfiles } from "@/services/profiles.service";
import { listAllTags, listProjects, listSubgroups, listTasks } from "@/services/tasks.service";
import { listSubsystems } from "@/services/subsystems.service";
import { AppShell } from "@/components/layout/app-shell";
import { PageBreadcrumb } from "@/components/layout/page-breadcrumb";
import { ProjectGrid } from "@/components/tasks/project-grid";
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

  const [profile, team, tasks, subgroups, projects, subsystems, allTags] = await Promise.all([
    getProfile(supabase, user.id),
    listProfiles(supabase),
    listTasks(supabase),
    listSubgroups(supabase),
    listProjects(supabase),
    listSubsystems(supabase),
    listAllTags(supabase),
  ]);

  // task deep links (push notifications) land inside the task's project view
  if (openTaskId && !projectId) {
    const target = tasks.find((t) => t.id === openTaskId);
    redirect(`/tasks?project=${target?.project_id ?? "none"}&task=${openTaskId}`);
  }

  const userName = profile?.display_name ?? "Teammate";
  const userAvatar = profile?.avatar_url ?? null;

  // no project selected → landing page with one KPI card per project
  if (!projectId) {
    return (
      <AppShell userName={userName} userAvatar={userAvatar} title="Projects">
        <main className="mx-auto max-w-6xl space-y-4 p-4">
          <ProjectGrid projects={projects} initialTasks={tasks} />
        </main>
      </AppShell>
    );
  }

  const project = projects.find((p) => p.id === projectId);
  const title = projectId === "none" ? "No project" : (project?.name ?? "Tasks");

  return (
    <AppShell userName={userName} userAvatar={userAvatar} title={title}>
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <PageBreadcrumb crumbs={[{ label: "Projects", href: "/tasks" }, { label: title }]} />
        <TasksView
          initialTasks={tasks}
          team={team}
          subgroups={subgroups}
          projects={projects}
          subsystems={subsystems}
          allTags={allTags}
          userId={user.id}
          openTaskId={openTaskId}
          projectId={projectId}
        />
      </main>
    </AppShell>
  );
}
