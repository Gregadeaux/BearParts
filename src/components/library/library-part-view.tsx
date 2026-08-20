"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FolderRow, LibraryPartDetail, PartVersion } from "@/types/library";
import type { ProfileRow } from "@/types/part";
import type { CommentAnchor, PartComment } from "@/services/comments.service";
import type { PartEvent } from "@/services/events.service";
import { useComments } from "@/components/comments/use-comments";
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
import { PdfWorkspace } from "@/components/viewer/pdf-workspace";
import { StepWorkspace } from "@/components/viewer/step-workspace";
import { VersionDocsTabs } from "./version-docs-tabs";
import type { VersionDocumentRow } from "@/services/version-documents.service";
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
  /** version id → its supporting documents (drawings, G-code) */
  documents: Record<string, VersionDocumentRow[]>;
}

/** Library part detail: versions + viewer beside a live discussion panel. */
export function LibraryPartView({
  part,
  ancestry,
  team,
  userId,
  initialComments,
  events,
  documents,
}: Props) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [selected, setSelected] = useState<PartVersion>(part.versions[0]);
  // keyed by version id so switching versions never shows stale content
  const [loaded, setLoaded] = useState<{
    id: string;
    content: { text?: string; buffer?: ArrayBuffer };
  } | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const content = loaded?.id === selected?.id ? loaded.content : null;
  const error = errorId === selected?.id;

  const { comments, pending, post, remove } = useComments(part.id, part.name, initialComments);
  const [pendingAnchor, setPendingAnchor] = useState<CommentAnchor | null>(null);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<{
    x: number;
    y: number;
    size?: number;
    nonce: number;
  } | null>(null);

  // pins shown on the currently selected version, numbered by comment order
  const anchored = comments.filter((c) => c.anchor?.versionId === selected?.id);
  const pinNumbers = Object.fromEntries(anchored.map((c, i) => [c.id, i + 1]));
  const annotations = anchored.map((c, i) => ({
    id: c.id,
    x: c.anchor!.x,
    y: c.anchor!.y,
    index: i + 1,
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = await getFileUrl(createClient(), selected.file_path);
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const value =
          selected.file_type === "dxf"
            ? { text: await res.text() }
            : { buffer: await res.arrayBuffer() };
        if (!cancelled) setLoaded({ id: selected.id, content: value });
      } catch {
        if (!cancelled) setErrorId(selected.id);
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
      <h1 className="min-w-0 truncate text-lg font-semibold" title={part.name}>
        {part.name}
      </h1>
      <span className="shrink-0 text-sm text-muted-foreground">
        {part.versions.length} version{part.versions.length === 1 ? "" : "s"}
      </span>
      <div className="ml-auto flex shrink-0 gap-2">
        <UploadVersionDialog libraryPartId={part.id} />
        {selected && <AddToQueueDialog partName={part.name} version={selected} team={team} />}
      </div>
    </div>
  );

  const viewer = error ? (
    <div className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">
      Could not load this version&apos;s file.
    </div>
  ) : !content ? (
    <Skeleton className="h-72 w-full" />
  ) : content.buffer && selected.file_type === "pdf" ? (
    <PdfWorkspace pdfBuffer={content.buffer} />
  ) : content.buffer && selected.file_type === "step" ? (
    <StepWorkspace stepBuffer={content.buffer} />
  ) : content.buffer ? (
    <StlWorkspace stlBuffer={content.buffer} />
  ) : null;

  const workspace = (
    <div className="space-y-4">
      <VersionHistory
        versions={part.versions}
        partName={part.name}
        selectedId={selected?.id}
        onSelect={setSelected}
      />
      {selected.file_type === "stl" || selected.file_type === "step" ? (
        // machined/printed models carry supporting docs: drawings + G-code
        <VersionDocsTabs
          key={selected.id}
          versionId={selected.id}
          versionNumber={selected.version}
          libraryPartId={part.id}
          initialDocs={documents[selected.id] ?? []}
        >
          {viewer}
        </VersionDocsTabs>
      ) : viewer !== null ? (
        viewer
      ) : (
        <DxfWorkspace
          dxfText={content!.text!}
          unitOverride={selected.units === "unknown" ? undefined : selected.units}
          annotations={annotations}
          selectedAnnotationId={focusedCommentId}
          onSelectAnnotation={setFocusedCommentId}
          draftAnnotation={pendingAnchor}
          focusTarget={focusTarget}
          onAnnotate={(snap) =>
            setPendingAnchor({
              x: snap.x,
              y: snap.y,
              versionId: selected.id,
              label: snap.label,
              size: snap.size,
            })
          }
        />
      )}
    </div>
  );

  const timeline = <PartTimeline versions={part.versions} events={events} />;

  const discussion = (className?: string) => (
    <CommentsPanel
      comments={comments}
      pending={pending}
      onPost={async (body) => {
        const ok = await post(body, pendingAnchor ?? undefined);
        if (ok) setPendingAnchor(null);
        return ok;
      }}
      onRemove={remove}
      userId={userId}
      team={team}
      versions={part.versions.map((v) => v.version)}
      onSelectVersion={selectByNumber}
      pinNumbers={pinNumbers}
      selectedCommentId={focusedCommentId}
      onFocusAnnotation={(comment) => {
        const anchor = comment.anchor;
        if (anchor) {
          const version = part.versions.find((v) => v.id === anchor.versionId);
          if (version) setSelected(version);
          setFocusTarget({ x: anchor.x, y: anchor.y, size: anchor.size, nonce: Date.now() });
        }
        setFocusedCommentId(comment.id);
      }}
      pendingAnchor={pendingAnchor}
      onClearAnchor={() => setPendingAnchor(null)}
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
          <ResizablePanel defaultSize={55} minSize={38}>
            <ScrollArea className="h-full pr-3">{workspace}</ScrollArea>
          </ResizablePanel>
          <ResizableHandle withHandle className="mx-1" />
          <ResizablePanel defaultSize={20} minSize={13}>
            <ScrollArea className="h-full pr-3">{timeline}</ScrollArea>
          </ResizablePanel>
          <ResizableHandle withHandle className="mx-1" />
          <ResizablePanel defaultSize={25} minSize={18}>
            {discussion("h-full")}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="space-y-4">
          {workspace}
          {timeline}
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
          <Link
            key={entry.id}
            href={`/parts/${entry.id}`}
            className="flex items-center gap-1 transition-opacity hover:opacity-75"
          >
            <StatusBadge status={entry.status as never} />
            {version && <span className="text-xs text-muted-foreground">v{version.version}</span>}
          </Link>
        );
      })}
    </div>
  );
}
