import Link from "next/link";
import type { Part } from "@/types/part";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge, PriorityBadge } from "./status-badge";
import { formatDate, formatInches } from "@/lib/format";

/** One row in the queue. Whole card is a link — big touch target. */
export function PartCard({ part }: { part: Part }) {
  const bb = part.analysis?.boundingBox;
  return (
    <Link href={`/parts/${part.id}`} className="block">
      <Card className="flex flex-row items-center gap-3 p-3 transition-colors hover:bg-accent/50">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{part.name}</span>
            <PriorityBadge priority={part.priority as never} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {part.quantity > 1 && <span>×{part.quantity}</span>}
            {part.material && <span>{part.material}</span>}
            {bb && (
              <span className="tabular-nums">
                {formatInches(bb.width)} × {formatInches(bb.height)}
              </span>
            )}
            <span>{formatDate(part.created_at)}</span>
          </div>
        </div>
        <StatusBadge status={part.status as never} />
        <PersonChip
          name={part.assignee?.display_name ?? null}
          avatar={part.assignee?.avatar_url ?? null}
        />
      </Card>
    </Link>
  );
}

function PersonChip({ name, avatar }: { name: string | null; avatar: string | null }) {
  if (!name) return <div className="w-7" aria-hidden />;
  return (
    <Avatar className="size-7" title={name}>
      {avatar && <AvatarImage src={avatar} alt={name} referrerPolicy="no-referrer" />}
      <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
