import Link from "next/link";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  Flag,
  ListTodo,
  SquareKanban,
  UserRound,
} from "lucide-react";
import type { Part } from "@/types/part";
import type { Task } from "@/types/task";
import type { MilestoneRow } from "@/services/milestones.service";
import { cn } from "@/lib/utils";
import { STATUS_META, formatDay, isOverdue } from "@/components/tasks/task-utils";

interface Props {
  parts: Part[];
  tasks: Task[];
  milestones: MilestoneRow[];
  userId: string;
  userName: string;
  /** server's yyyy-MM-dd */
  today: string;
}

const OPEN_PART_STATUSES = new Set(["queued", "assigned", "in_progress"]);
const MAX_LIST = 5;

function countdown(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}

/** The landing page: quick stats and the signed-in user's own work. */
export function HomeDashboard({ parts, tasks, milestones, userId, userName, today }: Props) {
  const openParts = parts.filter((p) => OPEN_PART_STATUSES.has(p.status));
  const openTasks = tasks.filter((t) => t.status !== "done");
  const overdueTasks = openTasks.filter((t) => isOverdue(t.due_date, t.status as never));
  const myParts = openParts.filter((p) => p.assigned_to === userId);
  const myTasks = openTasks.filter((t) => t.assignees.some((a) => a.id === userId));
  const upcoming = milestones.filter((m) => m.date >= today);
  const next = upcoming[0];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Welcome back, {userName.split(" ")[0]}</h2>
        <p className="text-sm text-muted-foreground">
          {myParts.length + myTasks.length > 0
            ? `${myParts.length + myTasks.length} things on your plate.`
            : "Nothing assigned to you right now."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          href="/board"
          icon={SquareKanban}
          label="Fab queue"
          value={String(openParts.length)}
          detail={`${openParts.filter((p) => p.status === "in_progress").length} in progress`}
        />
        <StatCard
          href="/tasks"
          icon={ListTodo}
          label="Open tasks"
          value={String(openTasks.length)}
          detail={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : "none overdue"}
          detailClass={overdueTasks.length > 0 ? "text-destructive font-medium" : undefined}
        />
        <StatCard
          href="/board"
          icon={UserRound}
          label="My work"
          value={String(myParts.length + myTasks.length)}
          detail={`${myParts.length} parts · ${myTasks.length} tasks`}
        />
        <StatCard
          href="/calendar"
          icon={Flag}
          label="Next milestone"
          value={next ? countdown(differenceInCalendarDays(parseISO(next.date), parseISO(today))) : "—"}
          detail={next ? next.title : "none scheduled"}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ListCard title="My parts" href="/board" emptyText="No parts assigned to you.">
          {myParts.slice(0, MAX_LIST).map((part) => (
            <Link
              key={part.id}
              href={`/parts/${part.id}`}
              className="flex items-center gap-2 border-t px-3 py-2 transition-colors hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1 truncate text-sm">{part.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {part.status === "in_progress" ? "in progress" : part.status}
              </span>
            </Link>
          ))}
        </ListCard>

        <ListCard title="My tasks" href="/tasks" emptyText="No tasks assigned to you.">
          {myTasks.slice(0, MAX_LIST).map((task) => (
            <Link
              key={task.id}
              href={`/tasks?project=${task.project_id ?? "none"}&task=${task.id}`}
              className="flex items-center gap-2 border-t px-3 py-2 transition-colors hover:bg-muted/50"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: task.subgroup?.color ?? "#94a3b8" }}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
              {task.due_date && (
                <span
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    isOverdue(task.due_date, task.status)
                      ? "font-medium text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {formatDay(task.due_date)}
                </span>
              )}
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {STATUS_META[task.status].label}
              </span>
            </Link>
          ))}
        </ListCard>
      </div>

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Milestones</h3>
            <Link
              href="/calendar"
              className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Calendar <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {upcoming.slice(0, 5).map((m) => (
              <Link
                key={m.id}
                href="/calendar"
                className="flex items-center gap-1.5 rounded-full bg-amber-100 py-1 pr-2.5 pl-2 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
              >
                <Flag className="size-3" />
                <span className="max-w-40 truncate">{m.title}</span>
                <span className="font-normal opacity-75">
                  {countdown(differenceInCalendarDays(parseISO(m.date), parseISO(today)))}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  href,
  icon: Icon,
  label,
  value,
  detail,
  detailClass,
}: {
  href: string;
  icon: typeof CalendarDays;
  label: string;
  value: string;
  detail: string;
  detailClass?: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-lg border bg-card p-3.5 shadow-sm transition-colors hover:bg-muted/50"
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className={cn("truncate text-xs text-muted-foreground", detailClass)}>{detail}</span>
    </Link>
  );
}

function ListCard({
  title,
  href,
  emptyText,
  children,
}: {
  title: string;
  href: string;
  emptyText: string;
  children: React.ReactNode[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <Link
          href={href}
          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          View all <ArrowRight className="size-3" />
        </Link>
      </div>
      {children.length === 0 ? (
        <p className="border-t px-3 py-3 text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        children
      )}
    </div>
  );
}
