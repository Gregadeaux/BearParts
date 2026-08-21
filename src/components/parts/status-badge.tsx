import { Badge } from "@/components/ui/badge";
import type { PartPriority, PartStatus } from "@/types/part";

const STATUS_STYLES: Record<PartStatus, string> = {
  queued: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  toolpaths: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  slicing: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  saw: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  ready: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  finishing: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  done: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const STATUS_LABELS: Record<PartStatus, string> = {
  queued: "Queued",
  toolpaths: "Needs toolpaths",
  slicing: "Needs slicing",
  saw: "Cut to length",
  ready: "Ready",
  in_progress: "In progress",
  finishing: "Finishing",
  done: "Done",
  rejected: "Rejected",
};

const METHOD_STYLES: Record<string, string> = {
  cnc: "border-amber-400/60 text-amber-700 dark:text-amber-400",
  laser: "border-sky-400/60 text-sky-700 dark:text-sky-400",
  manual: "border-zinc-400/60 text-zinc-600 dark:text-zinc-400",
  print: "border-violet-400/60 text-violet-700 dark:text-violet-400",
};

const METHOD_LABELS: Record<string, string> = {
  cnc: "CNC",
  laser: "Laser",
  manual: "Manual",
  print: "3DP",
};

export function MethodBadge({ method }: { method: string }) {
  return (
    <Badge variant="outline" className={METHOD_STYLES[method] ?? METHOD_STYLES.manual}>
      {METHOD_LABELS[method] ?? method}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: PartStatus }) {
  return <Badge className={STATUS_STYLES[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: PartPriority }) {
  if (priority === "normal") return null;
  const styles: Record<string, string> = {
    low: "border-zinc-300 text-zinc-500",
    high: "border-orange-400 text-orange-600 dark:text-orange-400",
    urgent: "border-red-500 text-red-600 dark:text-red-400",
  };
  return (
    <Badge variant="outline" className={styles[priority]}>
      {priority}
    </Badge>
  );
}
