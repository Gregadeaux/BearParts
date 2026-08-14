"use client";

import { TASK_STATUSES, type TaskStatus } from "@/types/task";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { STATUS_META } from "./task-utils";

const ITEMS = TASK_STATUSES.map((s) => ({ value: s.value, label: s.label }));

/** Dot-only status picker used inline on a row. */
export function StatusSelect({
  status,
  onChange,
}: {
  status: TaskStatus;
  onChange: (status: TaskStatus) => void;
}) {
  return (
    <Select
      value={status}
      items={ITEMS}
      onValueChange={(v) => onChange((v as TaskStatus | null) ?? status)}
    >
      <SelectTrigger
        size="sm"
        aria-label={`Status: ${STATUS_META[status].label}`}
        title={STATUS_META[status].label}
        className="size-6! shrink-0 justify-center rounded-full border-0 p-0 hover:bg-muted [&>svg]:hidden"
      >
        <StatusDot status={status} />
      </SelectTrigger>
      <SelectContent className="min-w-40">
        {TASK_STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            <StatusDot status={s.value} />
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Colored dot for a status. */
export function StatusDot({ status }: { status: TaskStatus }) {
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: STATUS_META[status].color }}
    />
  );
}
