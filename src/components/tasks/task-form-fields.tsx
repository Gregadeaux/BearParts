"use client";

import type { ReactNode } from "react";
import {
  TASK_STATUSES,
  type Person,
  type ProjectRow,
  type SubgroupRow,
  type TaskStatus,
} from "@/types/task";
import type { Subsystem } from "@/services/subsystems.service";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssigneePicker } from "./assignee-picker";
import { AvatarStack } from "./avatar-stack";
import { DateField } from "./date-field";
import { StatusDot } from "./status-select";
import { SubgroupSelect } from "./subgroup-select";

const STATUS_ITEMS = TASK_STATUSES.map((s) => ({ value: s.value, label: s.label }));

/** Everything the task dialog edits. */
export interface TaskDraft {
  title: string;
  description: string;
  status: TaskStatus;
  subgroupId: string | null;
  projectId: string | null;
  subsystemId: string | null;
  assigneeIds: string[];
  tags: string[];
  startDate: string | null;
  dueDate: string | null;
}

interface Props {
  draft: TaskDraft;
  onChange: (patch: Partial<TaskDraft>) => void;
  team: Person[];
  subgroups: SubgroupRow[];
  projects: ProjectRow[];
  subsystems: Subsystem[];
  onSubgroupCreated: (subgroup: SubgroupRow) => void;
}

const NO_PROJECT = "none";

/** Status / subgroup / project / subsystem / assignees / dates grid. Stacks to one column on phones. */
export function TaskFormFields({
  draft,
  onChange,
  team,
  subgroups,
  projects,
  subsystems,
  onSubgroupCreated,
}: Props) {
  const projectItems = [
    { value: NO_PROJECT, label: "No project" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];
  // subsystems belong to a project — only offer the current project's
  const projectSubsystems = subsystems.filter((s) => s.project_id === draft.projectId);
  const subsystemItems = [
    { value: NO_PROJECT, label: "No subsystem" },
    ...projectSubsystems.map((s) => ({ value: s.id, label: s.name })),
  ];
  const picked = team.filter((p) => draft.assigneeIds.includes(p.id));
  const badRange = Boolean(draft.startDate && draft.dueDate && draft.startDate > draft.dueDate);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Status">
        <Select
          value={draft.status}
          items={STATUS_ITEMS}
          onValueChange={(v) => onChange({ status: (v as TaskStatus | null) ?? draft.status })}
        >
          <SelectTrigger size="sm" className="w-full">
            <StatusDot status={draft.status} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <StatusDot status={s.value} />
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Subgroup">
        <SubgroupSelect
          subgroups={subgroups}
          value={draft.subgroupId}
          onChange={(subgroupId) => onChange({ subgroupId })}
          onCreated={onSubgroupCreated}
        />
      </Field>

      <Field label="Project">
        <Select
          value={draft.projectId ?? NO_PROJECT}
          items={projectItems}
          onValueChange={(v) => {
            const projectId = v === NO_PROJECT || v === null ? null : v;
            // a subsystem can't outlive its project
            const keep = subsystems.some(
              (s) => s.id === draft.subsystemId && s.project_id === projectId,
            );
            onChange({ projectId, subsystemId: keep ? draft.subsystemId : null });
          }}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {projectItems.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {projectSubsystems.length > 0 && (
        <Field label="Subsystem">
          <Select
            value={draft.subsystemId ?? NO_PROJECT}
            items={subsystemItems}
            onValueChange={(v) =>
              onChange({ subsystemId: v === NO_PROJECT || v === null ? null : v })
            }
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {subsystemItems.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field label="Assignees">
        <AssigneePicker
          people={team}
          selected={draft.assigneeIds}
          onChange={(assigneeIds) => onChange({ assigneeIds })}
          className="w-full justify-start font-normal"
        >
          {picked.length ? (
            <>
              <AvatarStack people={picked} max={4} />
              <span className="truncate text-muted-foreground">
                {picked.length === 1 ? picked[0].display_name : `${picked.length} people`}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          )}
        </AssigneePicker>
      </Field>

      <Field label="Start">
        <DateField
          value={draft.startDate}
          onChange={(startDate) => onChange({ startDate })}
          placeholder="No start"
        />
      </Field>

      <Field label="Due">
        <DateField
          value={draft.dueDate}
          onChange={(dueDate) => onChange({ dueDate })}
          placeholder="No due date"
        />
      </Field>

      {badRange && (
        <p className="text-xs text-destructive sm:col-span-2">Start is after the due date.</p>
      )}
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
