import Link from "next/link";
import { notFound } from "next/navigation";
import { Blocks, Folder, FolderKanban } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile, listProfiles } from "@/services/profiles.service";
import { listAllTags, listProjects, listSubgroups, listTasks } from "@/services/tasks.service";
import {
  getSubsystem,
  listSubsystems,
  subsystemPartIds,
  subsystemPartNames,
  subsystemQueueParts,
  subsystemUploads,
} from "@/services/subsystems.service";
import { listSubsystemComments } from "@/services/subsystem-comments.service";
import { listBomItems } from "@/services/bom.service";
import { AppShell } from "@/components/layout/app-shell";
import { TasksView } from "@/components/tasks/tasks-view";
import { SubsystemComments } from "@/components/subsystems/subsystem-comments";
import { SubsystemActions } from "@/components/subsystems/subsystem-actions";
import { BomTable } from "@/components/subsystems/bom-table";
import { StatusBadge } from "@/components/parts/status-badge";
import { AvatarStack } from "@/components/tasks/avatar-stack";
import { formatDateTime } from "@/lib/format";

export default async function SubsystemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const subsystem = await getSubsystem(supabase, id);
  if (!subsystem) notFound();

  const partIds = await subsystemPartIds(supabase, subsystem);
  const [
    profile,
    team,
    tasks,
    subgroups,
    projects,
    subsystems,
    allTags,
    queueParts,
    uploads,
    partNames,
    comments,
    bomItems,
  ] = await Promise.all([
    getProfile(supabase, user.id),
    listProfiles(supabase),
    listTasks(supabase),
    listSubgroups(supabase),
    listProjects(supabase),
    listSubsystems(supabase),
    listAllTags(supabase),
    subsystemQueueParts(supabase, partIds),
    subsystemUploads(supabase, partIds),
    subsystemPartNames(supabase, partIds),
    listSubsystemComments(supabase, id),
    listBomItems(supabase, id),
  ]);

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title={subsystem.name}
    >
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Blocks className="size-5 text-violet-500" />
          <h1 className="text-lg font-semibold">{subsystem.name}</h1>
          {subsystem.project && (
            <Link
              href={`/tasks?project=${subsystem.project.id}`}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              <FolderKanban className="size-3" /> {subsystem.project.name}
            </Link>
          )}
          {subsystem.folder && (
            <Link
              href={`/library?f=${subsystem.folder.id}`}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              <Folder className="size-3 fill-amber-200 text-amber-500" /> {subsystem.folder.name}
            </Link>
          )}
          <div className="flex-1" />
          <SubsystemActions
            subsystemId={subsystem.id}
            subsystemName={subsystem.name}
            folderId={subsystem.folder_id}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-5 lg:col-span-2">
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Tasks</h2>
              <TasksView
                initialTasks={tasks}
                team={team}
                subgroups={subgroups}
                projects={projects}
                subsystems={subsystems}
                allTags={allTags}
                userId={user.id}
                projectId={subsystem.project_id}
                subsystemId={subsystem.id}
              />
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Fab queue</h2>
              {queueParts.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  No parts from this subsystem are in the queue.
                </p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {queueParts.map((part) => (
                    <Link
                      key={part.id}
                      href={`/parts/${part.id}`}
                      className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">{part.name}</span>
                      {part.quantity > 1 && (
                        <span className="text-xs text-muted-foreground">×{part.quantity}</span>
                      )}
                      {part.assignee && <AvatarStack people={[part.assignee]} />}
                      <StatusBadge status={part.status as never} />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Bill of materials</h2>
              <BomTable subsystemId={subsystem.id} initial={bomItems} customParts={partNames} />
            </section>
          </div>

          <div className="min-w-0 space-y-4">
            <SubsystemComments
              subsystemId={subsystem.id}
              subsystemName={subsystem.name}
              team={team}
              userId={user.id}
              initial={comments}
              className="h-96"
            />

            <section className="space-y-2">
              <h2 className="text-sm font-semibold">History</h2>
              {uploads.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  No parts uploaded yet.
                </p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {uploads.map((upload) => (
                    <Link
                      key={upload.id}
                      href={upload.library_part ? `/library/parts/${upload.library_part.id}` : "#"}
                      className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {upload.library_part?.name ?? "Deleted part"}{" "}
                        <span className="text-muted-foreground">v{upload.version}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {upload.uploader?.display_name?.split(" ")[0] ?? ""} ·{" "}
                        {formatDateTime(upload.created_at)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
