"use client";

import Link from "next/link";
import { Blocks, Box, ExternalLink, FileText, FileType2, X } from "lucide-react";
import { useSubsystemSelection } from "./selection-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/parts/status-badge";
import { formatDate, formatInches } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Summary {
  name: string;
  projectName: string | null;
  partCount: number;
  queueCount: number;
  bomCount: number;
}

export interface PanelQueueEntry {
  id: string;
  status: string;
  quantity: number;
}

function TypeIcon({ type, className }: { type?: string; className?: string }) {
  if (type === "stl") return <Box className={cn(className, "text-violet-500")} />;
  if (type === "step") return <Box className={cn(className, "text-emerald-600")} />;
  if (type === "pdf") return <FileType2 className={cn(className, "text-red-400")} />;
  return <FileText className={cn(className, "text-sky-500")} />;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  );
}

/**
 * Drive-style details pane: subsystem overview until a part is clicked in the
 * Parts tab, then that part's high-level metadata.
 */
export function PartInfoPanel({
  summary,
  queueByPart = {},
  className,
}: {
  summary: Summary;
  /** library part id → its fab-queue entries */
  queueByPart?: Record<string, PanelQueueEntry[]>;
  className?: string;
}) {
  const ctx = useSubsystemSelection();
  const selection = ctx?.selection ?? null;

  if (!selection) {
    return (
      <Card className={cn("gap-3 overflow-y-auto p-4", className)}>
        <div className="flex items-center gap-2">
          <Blocks className="size-4 shrink-0 text-violet-500" />
          <p className="min-w-0 truncate text-sm font-medium">{summary.name}</p>
        </div>
        <div className="space-y-1.5">
          <Row label="Project">{summary.projectName ?? "—"}</Row>
          <Row label="Parts">{summary.partCount}</Row>
          <Row label="In fab queue">{summary.queueCount}</Row>
          <Row label="BOM items">{summary.bomCount}</Row>
        </div>
        <p className="mt-auto text-xs text-muted-foreground">
          Click a part in the Parts tab to inspect it here.
        </p>
      </Card>
    );
  }

  const { part, thumbUrl } = selection;
  const latest = part.latest;
  const bb = latest?.analysis?.boundingBox;
  const holes = latest?.analysis?.holes?.length ?? 0;

  return (
    <Card className={cn("gap-3 overflow-y-auto p-4", className)}>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium" title={part.name}>
          {part.name}
        </p>
        <button
          type="button"
          aria-label="Clear selection"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => ctx?.setSelection(null)}
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex h-32 items-center justify-center overflow-hidden rounded-md border bg-white">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt={`${part.name} preview`} className="max-h-full max-w-full object-contain" />
        ) : (
          <TypeIcon type={latest?.file_type} className="size-8 opacity-40" />
        )}
      </div>

      <div className="flex items-center gap-2">
        <TypeIcon type={latest?.file_type} className="size-4 shrink-0" />
        <span className="text-sm uppercase">{latest?.file_type ?? "—"}</span>
        {latest && <Badge variant="secondary">v{latest.version}</Badge>}
      </div>

      <div className="space-y-1.5">
        <Row label="Versions">{part.versionCount}</Row>
        <Row label="Updated">{formatDate(part.updated_at)}</Row>
        {latest?.uploader && <Row label="By">{latest.uploader.display_name}</Row>}
        {bb && (
          <Row label="Size">
            {formatInches(bb.width)} × {formatInches(bb.height)}
          </Row>
        )}
        {latest?.analysis && <Row label="Holes">{holes}</Row>}
        {latest?.units && latest.units !== "unknown" && <Row label="Units">{latest.units}</Row>}
      </div>

      {(queueByPart[part.id] ?? []).length > 0 && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Fabrication</p>
            {(queueByPart[part.id] ?? []).map((entry) => (
              <Link
                key={entry.id}
                href={`/parts/${entry.id}`}
                className="flex items-center justify-between gap-2 text-sm hover:underline"
              >
                <StatusBadge status={entry.status as never} />
                {entry.quantity > 1 && (
                  <span className="text-xs text-muted-foreground">×{entry.quantity}</span>
                )}
              </Link>
            ))}
          </div>
        </>
      )}

      {latest?.note && (
        <>
          <Separator />
          <p className="text-sm text-muted-foreground">{latest.note}</p>
        </>
      )}

      <Button
        size="sm"
        className="mt-auto"
        nativeButton={false}
        render={<Link href={`/library/parts/${part.id}`} />}
      >
        <ExternalLink /> Open part
      </Button>
    </Card>
  );
}
