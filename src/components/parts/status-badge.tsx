import { Badge } from "@/components/ui/badge";
import type { PartPriority, PartStatus } from "@/types/part";

const STATUS_STYLES: Record<PartStatus, string> = {
  queued: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  assigned: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  done: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const STATUS_LABELS: Record<PartStatus, string> = {
  queued: "Queued",
  assigned: "Assigned",
  in_progress: "In progress",
  done: "Done",
  rejected: "Rejected",
};

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
