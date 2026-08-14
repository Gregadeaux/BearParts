import { format, parseISO } from "date-fns";
import { TASK_STATUSES, type TaskStatus } from "@/types/task";

/** Status metadata (label + dot color) keyed by status value. */
export const STATUS_META = Object.fromEntries(TASK_STATUSES.map((s) => [s.value, s])) as Record<
  TaskStatus,
  (typeof TASK_STATUSES)[number]
>;

/** Group order in the list — Done sinks to the bottom (and starts collapsed). */
export const STATUS_ORDER: TaskStatus[] = ["in_progress", "blocked", "todo", "done"];

/** Palette offered when creating a subgroup on the fly. */
export const SUBGROUP_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#14b8a6",
  "#64748b",
];

/** Today as a plain `yyyy-MM-dd` string (local calendar day). */
export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** `"2026-08-14"` → `"Aug 14"` — parsed as a local calendar day, never shifted. */
export function formatDay(iso: string): string {
  return format(parseISO(iso), "MMM d");
}

/** `yyyy-MM-dd` → local-midnight Date for `<Calendar/>`. */
export function toDate(iso: string | null | undefined): Date | undefined {
  return iso ? parseISO(iso) : undefined;
}

/** Date → `yyyy-MM-dd` using local parts, so the picked day is the stored day. */
export function toISODate(date: Date | null | undefined): string | null {
  return date ? format(date, "yyyy-MM-dd") : null;
}

/** Past due and still open. */
export function isOverdue(dueDate: string | null, status: TaskStatus): boolean {
  if (!dueDate || status === "done") return false;
  return dueDate < todayISO();
}
