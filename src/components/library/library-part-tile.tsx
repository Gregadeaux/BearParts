"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Folder, FileText, Box, FileType2 } from "lucide-react";
import type { LibraryPartListing } from "@/types/library";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

interface Props {
  part: LibraryPartListing;
  thumbUrl?: string;
  /** shown under the name for search results */
  folderName?: string | null;
  /** select-on-click mode (subsystem workspace) — double-click still opens */
  onSelect?: () => void;
  selected?: boolean;
}

function TypeIcon({ type, className }: { type?: string; className: string }) {
  if (type === "stl") return <Box className={`${className} text-violet-500`} />;
  if (type === "pdf") return <FileType2 className={`${className} text-red-400`} />;
  if (type === "step") return <Box className={`${className} text-emerald-600`} />;
  return <FileText className={`${className} text-sky-500`} />;
}

/** One library part card: preview, name, version badge. */
export function LibraryPartTile({ part, thumbUrl, folderName, onSelect, selected }: Props) {
  const router = useRouter();
  const card = (
      <Card
        className={cn(
          "gap-2 p-3 shadow-sm transition-all hover:bg-accent/50 hover:shadow-md",
          selected && "ring-2 ring-primary/60",
        )}
      >
        <div className="flex h-24 items-center justify-center overflow-hidden rounded-md bg-white">
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt={`${part.name} preview`}
              className="max-h-full max-w-full object-contain"
              loading="lazy"
            />
          ) : (
            <TypeIcon type={part.latest?.file_type} className="size-8 opacity-40" />
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <TypeIcon type={part.latest?.file_type} className="size-4 shrink-0" />
          <span className="truncate text-sm font-medium" title={part.name}>
            {part.name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {part.latest && <Badge variant="secondary">v{part.latest.version}</Badge>}
          {folderName && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Folder className="size-3 shrink-0" />
              <span className="truncate">{folderName}</span>
            </span>
          )}
          <span className="ml-auto shrink-0">{formatDate(part.updated_at)}</span>
        </div>
      </Card>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        className="block w-full text-left"
        onClick={onSelect}
        onDoubleClick={() => router.push(`/library/parts/${part.id}`)}
        title="Click to inspect, double-click to open"
      >
        {card}
      </button>
    );
  }
  return (
    <Link href={`/library/parts/${part.id}`} className="block">
      {card}
    </Link>
  );
}
