"use client";

import { Plus, Search, Users } from "lucide-react";
import type { Person, SubgroupRow } from "@/types/task";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssigneePicker } from "./assignee-picker";
import { AvatarStack } from "./avatar-stack";
import { TagFilter } from "./tag-filter";
import type { GroupBy, TaskFilters as Filters } from "./use-tasks";

const GROUP_ITEMS = [
  { value: "status", label: "Group: Status" },
  { value: "subgroup", label: "Group: Subgroup" },
];

interface Props {
  filters: Filters;
  onFiltersChange: (patch: Partial<Filters>) => void;
  groupBy: GroupBy;
  onGroupByChange: (groupBy: GroupBy) => void;
  team: Person[];
  subgroups: SubgroupRow[];
  allTags: string[];
  onNewTask: () => void;
}

/** Search, filter pills and grouping controls above the list. */
export function TaskFilters({
  filters,
  onFiltersChange,
  groupBy,
  onGroupByChange,
  team,
  subgroups,
  allTags,
  onNewTask,
}: Props) {
  const toggleSubgroup = (id: string) =>
    onFiltersChange({
      subgroupIds: filters.subgroupIds.includes(id)
        ? filters.subgroupIds.filter((x) => x !== id)
        : [...filters.subgroupIds, id],
    });

  const picked = team.filter((p) => filters.assigneeIds.includes(p.id));

  return (
    <div className="sticky top-14 z-20 -mx-4 space-y-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(e) => onFiltersChange({ query: e.target.value })}
            placeholder="Search tasks…"
            className="pl-8"
          />
        </div>
        <Button size="sm" onClick={onNewTask} className="shrink-0">
          <Plus /> New task
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {subgroups.map((sub) => {
          const active = filters.subgroupIds.includes(sub.id);
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => toggleSubgroup(sub.id)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                active ? "font-medium text-foreground" : "text-muted-foreground hover:bg-muted",
              )}
              style={
                active
                  ? { backgroundColor: `${sub.color}22`, borderColor: sub.color }
                  : undefined
              }
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: sub.color }}
              />
              {sub.name}
            </button>
          );
        })}

        <AssigneePicker
          people={team}
          selected={filters.assigneeIds}
          onChange={(assigneeIds) => onFiltersChange({ assigneeIds })}
        >
          {picked.length ? (
            <>
              <AvatarStack people={picked} max={3} />
              <span className="sr-only">Filter by assignee</span>
            </>
          ) : (
            <>
              <Users /> Anyone
            </>
          )}
        </AssigneePicker>

        <TagFilter
          tags={allTags}
          selected={filters.tags}
          onChange={(tags) => onFiltersChange({ tags })}
        />

        <Button
          size="sm"
          variant={filters.mine ? "secondary" : "outline"}
          onClick={() => onFiltersChange({ mine: !filters.mine })}
        >
          My tasks
        </Button>

        <Select
          value={groupBy}
          items={GROUP_ITEMS}
          onValueChange={(v) => onGroupByChange((v as GroupBy | null) ?? "status")}
        >
          <SelectTrigger size="sm" className="ml-auto w-32" aria-label="Group by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUP_ITEMS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
