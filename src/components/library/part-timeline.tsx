"use client";

import Link from "next/link";
import {
  Check,
  Hammer,
  Play,
  RotateCcw,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import type { PartEvent, PartEventType } from "@/services/events.service";
import type { PartVersion } from "@/types/library";
import { formatDateTime } from "@/lib/format";

interface Props {
  versions: PartVersion[];
  events: PartEvent[];
}

interface Entry {
  key: string;
  at: string;
  icon: React.ReactNode;
  text: React.ReactNode;
  sub?: string;
}

const EVENT_ICONS: Record<PartEventType, React.ReactNode> = {
  queued: <Hammer className="size-3.5" />,
  assigned: <UserPlus className="size-3.5" />,
  unassigned: <UserMinus className="size-3.5" />,
  started: <Play className="size-3.5" />,
  completed: <Check className="size-3.5 text-green-600" />,
  rejected: <X className="size-3.5 text-red-500" />,
  requeued: <RotateCcw className="size-3.5" />,
  removed: <Trash2 className="size-3.5" />,
};

function eventText(e: PartEvent): React.ReactNode {
  const v = e.version ? `v${e.version}` : "part";
  const who = e.detail?.assignee;
  const partLink = (label: string) =>
    e.part_id ? (
      <Link href={`/parts/${e.part_id}`} className="underline underline-offset-2 hover:text-foreground">
        {label}
      </Link>
    ) : (
      label
    );

  switch (e.event) {
    case "queued":
      return <>{partLink(`${v} sent to fab queue`)}{who ? `, assigned to ${who}` : ""}</>;
    case "assigned":
      return <>{partLink(v)} assigned to {who ?? "someone"}</>;
    case "unassigned":
      return <>{partLink(v)} returned to the queue</>;
    case "started":
      return <>{partLink(v)} machining started{who ? ` by ${who}` : ""}</>;
    case "completed":
      return <>{partLink(v)} completed</>;
    case "rejected":
      return <>{partLink(v)} rejected</>;
    case "requeued":
      return <>{partLink(v)} re-queued</>;
    case "removed":
      return <>{v} removed from the queue</>;
  }
}

/** Merged history: version uploads + fab-queue audit events, newest first. */
export function PartTimeline({ versions, events }: Props) {
  const entries: Entry[] = [
    ...versions.map((v) => ({
      key: `v-${v.id}`,
      at: v.created_at,
      icon: <Upload className="size-3.5" />,
      text: (
        <>
          v{v.version} uploaded{v.uploader ? ` by ${v.uploader.display_name}` : ""}
        </>
      ),
      sub: v.note ?? undefined,
    })),
    ...events.map((e) => ({
      key: `e-${e.id}`,
      at: e.created_at,
      icon: EVENT_ICONS[e.event],
      text: eventText(e),
      sub: e.actor && e.event !== "started" ? `by ${e.actor.display_name}` : undefined,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">History</h2>
      <ol className="relative ml-3 space-y-4 border-l pl-5">
        {entries.map((entry) => (
          <li key={entry.key} className="relative text-sm">
            <span className="absolute -left-[27px] top-0.5 flex size-4.5 items-center justify-center rounded-full border bg-background text-muted-foreground">
              {entry.icon}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span>{entry.text}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {formatDateTime(entry.at)}
              </span>
            </div>
            {entry.sub && <p className="text-xs text-muted-foreground">{entry.sub}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
