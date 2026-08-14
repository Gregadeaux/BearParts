"use client";

import type { Person, SubgroupRow } from "@/types/task";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  subgroups: SubgroupRow[];
  team: Person[];
  subgroupIds: string[];
  assigneeIds: string[];
  mine: boolean;
  canFilterMine: boolean;
  onToggleSubgroup: (id: string) => void;
  onToggleAssignee: (id: string) => void;
  onToggleMine: () => void;
}

/** Subgroup pills + assignee picker + "My tasks" — wraps to one column at 390px. */
export function CalendarFilters({
  subgroups,
  team,
  subgroupIds,
  assigneeIds,
  mine,
  canFilterMine,
  onToggleSubgroup,
  onToggleAssignee,
  onToggleMine,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {subgroups.map((sg) => {
        const on = subgroupIds.includes(sg.id);
        return (
          <button
            key={sg.id}
            type="button"
            onClick={() => onToggleSubgroup(sg.id)}
            aria-pressed={on}
            style={
              on
                ? {
                    backgroundColor: `color-mix(in srgb, ${sg.color} 18%, transparent)`,
                    borderColor: sg.color,
                  }
                : undefined
            }
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs",
              !on && "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: sg.color }} />
            {sg.name}
          </button>
        );
      })}

      <Popover>
        <PopoverTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {assigneeIds.length > 0 ? `Assignees (${assigneeIds.length})` : "Assignee"}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0">
          <Command>
            <CommandInput placeholder="Find teammate" />
            <CommandList>
              <CommandEmpty>Nobody found</CommandEmpty>
              <CommandGroup>
                {team.map((person) => (
                  <CommandItem
                    key={person.id}
                    value={person.display_name}
                    data-checked={assigneeIds.includes(person.id)}
                    onSelect={() => onToggleAssignee(person.id)}
                  >
                    {person.display_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {canFilterMine && (
        <button
          type="button"
          onClick={onToggleMine}
          aria-pressed={mine}
          className={cn(
            buttonVariants({ variant: mine ? "secondary" : "outline", size: "sm" }),
            "shrink-0",
          )}
        >
          My tasks
        </button>
      )}
    </div>
  );
}
