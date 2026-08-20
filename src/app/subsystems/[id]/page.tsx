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
import { listFolders, getAncestry } from "@/services/folders.service";
import { listLibraryParts, subtreeFolderIds } from "@/services/library.service";
import { getFileUrl } from "@/services/storage.service";
import { AppShell } from "@/components/layout/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TasksView } from "@/components/tasks/tasks-view";
import { LibraryBrowser } from "@/components/library/library-browser";
import { SubsystemComments } from "@/components/subsystems/subsystem-comments";
import { SubsystemActions } from "@/components/subsystems/subsystem-actions";
import { HistoryPanel } from "@/components/subsystems/history-panel";
import { BomTable } from "@/components/subsystems/bom-table";
import { StatusBadge } from "@/components/parts/status-badge";
import { AvatarStack } from "@/components/tasks/avatar-stack";

export default async function SubsystemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const { id } = await params;
  const { f: folderParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const subsystem = await getSubsystem(supabase, id);
  if (!subsystem) notFound();

  // the parts tab browses within the subsystem's subtree only
  const subtree = await subtreeFolderIds(supabase, subsystem.folder_id);
  const currentFolderId =
    folderParam && subtree.includes(folderParam) ? folderParam : subsystem.folder_id;

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
    folders,
    folderParts,
    fullAncestry,
  ] = await Promise.all([
    getProfile(supabase, user.id),
    listProfiles(supabase),
    listTasks(supabase),
    listSubgroups(supabase),
    listProjects(supabase),
    listSubsystems(supabase),
    listAllTags(supabase),
    subsystemQueueParts(supabase, partIds),
    subsystemUploads(supabase, partIds, 50),
    subsystemPartNames(supabase, partIds),
    listSubsystemComments(supabase, id),
    listBomItems(supabase, id),
    listFolders(supabase, currentFolderId),
    listLibraryParts(supabase, currentFolderId),
    getAncestry(supabase, currentFolderId),
  ]);

  // breadcrumb starts at the subsystem's own folder
  const rootIndex = fullAncestry.findIndex((f) => f.id === subsystem.folder_id);
  const ancestry = rootIndex >= 0 ? fullAncestry.slice(rootIndex) : fullAncestry;

  const thumbEntries = await Promise.all(
    folderParts
      .filter((p) => p.latest?.thumb_path)
      .map(async (p) => {
        try {
          return [p.id, await getFileUrl(supabase, p.latest!.thumb_path!)] as const;
        } catch {
          return null;
        }
      }),
  );
  const thumbUrls = Object.fromEntries(thumbEntries.filter((e): e is [string, string] => e !== null));

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title={subsystem.name}
    >
      <main className="space-y-4 p-4">
        {/* header row spans all columns */}
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

        {/* history | tabbed center (~50%) | discussion */}
        <div className="grid gap-4 lg:h-[calc(100dvh-10.5rem)] lg:grid-cols-[20fr_55fr_25fr]">
          <HistoryPanel
            uploads={uploads}
            className="order-2 h-80 lg:order-none lg:h-auto"
          />

          <div className="order-1 flex min-h-0 min-w-0 flex-col lg:order-none">
            <Tabs defaultValue="parts" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="w-full">
                <TabsTrigger value="parts">Parts</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="queue">Fab queue</TabsTrigger>
                <TabsTrigger value="bom">BOM</TabsTrigger>
              </TabsList>

              <TabsContent value="parts" className="min-h-0 flex-1 overflow-y-auto pt-2">
                <LibraryBrowser
                  currentFolderId={currentFolderId}
                  ancestry={ancestry}
                  folders={folders}
                  parts={folderParts}
                  subsystems={subsystems}
                  projects={projects}
                  thumbUrls={thumbUrls}
                  basePath={`/subsystems/${subsystem.id}`}
                  embedded
                />
              </TabsContent>

              <TabsContent value="tasks" className="min-h-0 flex-1 overflow-y-auto pt-2">
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
                  embedded
                />
              </TabsContent>

              <TabsContent value="queue" className="min-h-0 flex-1 overflow-y-auto pt-2">
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
              </TabsContent>

              <TabsContent value="bom" className="min-h-0 flex-1 overflow-y-auto pt-2">
                <BomTable subsystemId={subsystem.id} initial={bomItems} customParts={partNames} />
              </TabsContent>
            </Tabs>
          </div>

          <SubsystemComments
            subsystemId={subsystem.id}
            subsystemName={subsystem.name}
            team={team}
            userId={user.id}
            initial={comments}
            className="order-3 h-96 lg:order-none lg:h-auto"
          />
        </div>
      </main>
    </AppShell>
  );
}
