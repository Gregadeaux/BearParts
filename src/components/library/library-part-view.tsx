"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FolderRow, LibraryPartDetail, PartVersion } from "@/types/library";
import type { ProfileRow } from "@/types/part";
import { createClient } from "@/lib/supabase/client";
import { getFileUrl } from "@/services/storage.service";
import { LibraryBreadcrumb } from "./library-breadcrumb";
import { VersionHistory } from "./version-history";
import { AddToQueueDialog } from "./add-to-queue-dialog";
import { UploadVersionDialog } from "./upload-version-dialog";
import { DxfWorkspace } from "@/components/viewer/dxf-workspace";
import { StlWorkspace } from "@/components/viewer/stl-workspace";
import { StatusBadge } from "@/components/parts/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";

interface Props {
  part: LibraryPartDetail;
  ancestry: FolderRow[];
  team: ProfileRow[];
}

/** Library part detail: version history on top, viewer for the selected version below. */
export function LibraryPartView({ part, ancestry, team }: Props) {
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

  return (
    <div className="space-y-4">
      <LibraryBreadcrumb ancestry={ancestry} />

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

      {part.queueEntries.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Fab queue history</h2>
          <div className="divide-y rounded-lg border">
            {part.queueEntries.map((entry) => {
              const version = part.versions.find((v) => v.id === entry.source_version_id);
              return (
                <Link
                  key={entry.id}
                  href={`/parts/${entry.id}`}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-accent/50"
                >
                  <StatusBadge status={entry.status as never} />
                  {version && <span className="text-xs text-muted-foreground">v{version.version}</span>}
                  {entry.quantity > 1 && <span className="text-xs text-muted-foreground">×{entry.quantity}</span>}
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {entry.assignee?.display_name ?? ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
