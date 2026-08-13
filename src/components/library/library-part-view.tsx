"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FolderRow, LibraryPartDetail, PartVersion } from "@/types/library";
import type { ProfileRow } from "@/types/part";
import type { PartComment } from "@/services/comments.service";
import type { PartEvent } from "@/services/events.service";
import { createClient } from "@/lib/supabase/client";
import { getFileUrl } from "@/services/storage.service";
import { useMediaQuery } from "@/lib/use-media-query";
import { LibraryBreadcrumb } from "./library-breadcrumb";
import { VersionHistory } from "./version-history";
import { PartTimeline } from "./part-timeline";
import { AddToQueueDialog } from "./add-to-queue-dialog";
import { UploadVersionDialog } from "./upload-version-dialog";
import { CommentsPanel } from "@/components/comments/comments-panel";
import { DxfWorkspace } from "@/components/viewer/dxf-workspace";
import { StlWorkspace } from "@/components/viewer/stl-workspace";
import { StatusBadge } from "@/components/parts/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
interface Props {
  part: LibraryPartDetail;
  ancestry: FolderRow[];
  team: ProfileRow[];
  userId: string;
  initialComments: PartComment[];
  events: PartEvent[];
}

/** Library part detail: versions + viewer beside a live discussion panel. */
export function LibraryPartView({ part, ancestry, team, userId, initialComments, events }: Props) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [selected, setSelected] = useState<PartVersion>(part.versions[0]);
  const [content, setContent] = useState<{ text?: string; buffer?: ArrayBuffer } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(false);
    (async () => {
      try {
        const url = await getFileUrl(createClient(), selected.file_path);
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const value =
          selected.file_type === "stl"
            ? { buffer: await res.arrayBuffer() }
            : { text: await res.text() };
        if (!cancelled) setContent(value);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const selectByNumber = useCallback(
    (versionNumber: number) => {
      const version = part.versions.find((v) => v.version === versionNumber);
      if (version) setSelected(version);
    },
    [part.versions],
  );

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="text-lg font-semibold">{part.name}</h1>
      <span className="text-sm text-muted-foreground">
        {part.versions.length} version{part.versions.length === 1 ? "" : "s"}
      </span>
      <div className="ml-auto flex gap-2">
        <UploadVersionDialog libraryPartId={part.id} />
        {selected && <AddToQueueDialog partName={part.name} version={selected} team={team} />}
      </div>
    </div>
  );

  const workspace = (
    <div className="space-y-4">
      <VersionHistory
        versions={part.versions}
        partName={part.name}
        selectedId={selected?.id}
        onSelect={setSelected}
      />
      {error ? (
        <p className="text-sm text-destructive">Could not load this version&apos;s file.</p>
      ) : !content ? (
        <Skeleton className="h-72 w-full" />
      ) : content.buffer ? (
        <StlWorkspace stlBuffer={content.buffer} />
      ) : (
        <DxfWorkspace
          dxfText={content.text!}
          unitOverride={selected.units === "unknown" ? undefined : selected.units}
        />
      )}
      <PartTimeline versions={part.versions} events={events} />
    </div>
  );

  const discussion = (className?: string) => (
    <CommentsPanel
      libraryPartId={part.id}
      partName={part.name}
      userId={userId}
      team={team}
      versions={part.versions.map((v) => v.version)}
      initialComments={initialComments}
      onSelectVersion={selectByNumber}
      className={className}
    />
  );

  return (
    <div className="space-y-4">
      <LibraryBreadcrumb ancestry={ancestry} />
      {header}
      <ActiveQueueEntries part={part} />

      {isDesktop ? (
        <ResizablePanelGroup className="h-[calc(100svh-11rem)] items-stretch">
          <ResizablePanel defaultSize={70} minSize={45}>
            <ScrollArea className="h-full pr-4">{workspace}</ScrollArea>
          </ResizablePanel>
          <ResizableHandle withHandle className="mx-1" />
          <ResizablePanel defaultSize={30} minSize={20}>
            {discussion("h-full")}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="space-y-4">
          {workspace}
          {discussion("h-96")}
        </div>
      )}
    </div>
  );
}

function ActiveQueueEntries({ part }: { part: LibraryPartDetail }) {
  const active = part.queueEntries.filter(
    (e) => e.status !== "done" && e.status !== "rejected",
  );
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">On the board:</span>
      {active.map((entry) => {
        const version = part.versions.find((v) => v.id === entry.source_version_id);
        return (
          <Link key={entry.id} href={`/parts/${entry.id}`} className="flex items-center gap-1">
            <StatusBadge status={entry.status as never} />
            {version && <span className="text-xs text-muted-foreground">v{version.version}</span>}
          </Link>
        );
      })}
    </div>
  );
}
