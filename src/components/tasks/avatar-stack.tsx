import type { Person } from "@/types/task";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  people: Person[];
  /** how many faces before collapsing into "+N" */
  max?: number;
  className?: string;
}

/** Overlapping face pile, capped at `max`. */
export function AvatarStack({ people, max = 3, className }: Props) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;

  return (
    <div className={cn("flex shrink-0 -space-x-1.5", className)}>
      {shown.map((p) => (
        <Avatar key={p.id} size="sm" className="ring-2 ring-background" title={p.display_name}>
          {p.avatar_url && (
            <AvatarImage src={p.avatar_url} alt={p.display_name} referrerPolicy="no-referrer" />
          )}
          <AvatarFallback className="text-[10px]">{initials(p.display_name)}</AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground ring-2 ring-background">
          +{extra}
        </span>
      )}
    </div>
  );
}
