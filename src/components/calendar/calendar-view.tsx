"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { addMonths, differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, Flag } from "lucide-react";
import { toast } from "sonner";
import type { Person, ProjectRow, SubgroupRow, Task } from "@/types/task";
import type { MilestoneRow } from "@/services/milestones.service";
import { useMediaQuery } from "@/lib/use-media-query";
import { updateTaskAction } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { TaskDialog, type TaskDialogProps } from "@/components/tasks/task-dialog";
import { AgendaList } from "./agenda-list";
import {
  buildMonthMatrix,
  computeMonthLayout,
  isUnscheduled,
  tasksOnDay,
  toDayKey,
} from "./calendar-layout";
import { CalendarFilters } from "./calendar-filters";
import { MilestoneDialog, type MilestoneDialogState } from "./milestone-dialog";
import { MilestoneStrip } from "./milestone-strip";
import { MonthGrid } from "./month-grid";
import { UnscheduledList } from "./unscheduled-list";
import { useCalendarTasks } from "./use-calendar-tasks";
import { milestonesOnDay, useMilestones } from "./use-milestones";

const MAX_LANES = 3;

/** `today` has no external store to watch — the snapshot is re-read on every render. */
const subscribeNever = () => () => {};

interface Props {
  initialTasks: Task[];
  initialMilestones: MilestoneRow[];
  subgroups: SubgroupRow[];
  team: Person[];
  projects: ProjectRow[];
  allTags: string[];
  userId: string | null;
  /** the server's today (yyyy-MM-dd); the browser's own takes over after hydration */
  initialToday: string;
}

type DialogState = Pick<TaskDialogProps, "task" | "defaults">;

/** Month calendar: bars for dated tasks, drag to reschedule, agenda on phones. */
export function CalendarView({
  initialTasks,
  initialMilestones,
  subgroups,
  team,
  projects,
  allTags,
  userId,
  initialToday,
}: Props) {
  const { tasks, setTasks, visible, filters, toggleSubgroup, toggleAssignee, toggleMine } =
    useCalendarTasks(initialTasks, userId);
  const { milestones, refetch: refetchMilestones } = useMilestones(initialMilestones);
  const [cursor, setCursor] = useState(() => parseISO(initialToday));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [milestoneDialog, setMilestoneDialog] = useState<MilestoneDialogState | null>(null);
  const compact = !useMediaQuery("(min-width: 1024px)");

  // SSR uses the server's date so hydration matches; the browser's takes over after
  const today = useSyncExternalStore(
    subscribeNever,
    () => toDayKey(new Date()),
    () => initialToday,
  );

  const matrix = useMemo(() => buildMonthMatrix(cursor), [cursor]);
  const layouts = useMemo(() => computeMonthLayout(visible, matrix, MAX_LANES), [visible, matrix]);
  const unscheduled = useMemo(() => visible.filter(isUnscheduled), [visible]);
  const monthKey = format(cursor, "yyyy-MM");

  /** Optimistic date patch with rollback. */
  const patchDates = async (
    taskId: string,
    next: Partial<Pick<Task, "start_date" | "due_date">>,
  ) => {
    const before = tasks.find((t) => t.id === taskId);
    if (!before) return;
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, ...next } : t)));
    try {
      await updateTaskAction(taskId, {
        ...(next.start_date !== undefined ? { startDate: next.start_date } : {}),
        ...(next.due_date !== undefined ? { dueDate: next.due_date } : {}),
      });
    } catch (e) {
      setTasks((ts) => ts.map((t) => (t.id === taskId ? before : t)));
      toast.error(e instanceof Error ? e.message : "Could not reschedule");
    }
  };

  /** Drop on a day: move the due date there, dragging the start date along. */
  const moveTask = (taskId: string, day: string) => {
    setDragTaskId(null);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.due_date) {
      if (task.due_date === day) return;
      if (!task.start_date) return void patchDates(taskId, { due_date: day });
      const span = Math.abs(
        differenceInCalendarDays(parseISO(task.due_date), parseISO(task.start_date)),
      );
      patchDates(taskId, { due_date: day, start_date: toDayKey(subDays(parseISO(day), span)) });
    } else if (task.start_date !== day) {
      patchDates(taskId, { start_date: day }); // start-only task keeps its single date
    }
  };

  const goToday = () => {
    setCursor(parseISO(today));
    setSelectedDay(today);
  };

  const openDay = (day: string) => {
    if (compact) setSelectedDay(day);
    else setDialog({ defaults: { dueDate: day } });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous month"
          onClick={() => setCursor((c) => addMonths(c, -1))}
        >
          <ChevronLeftIcon />
        </Button>
        <h1 className="min-w-36 text-center text-base font-semibold sm:text-lg">
          {format(cursor, "MMMM yyyy")}
        </h1>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next month"
          onClick={() => setCursor((c) => addMonths(c, 1))}
        >
          <ChevronRightIcon />
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setMilestoneDialog({ milestone: null, defaultDate: selectedDay ?? today })
          }
        >
          <Flag /> Milestone
        </Button>
        <Button variant="outline" size="sm" onClick={goToday}>
          Today
        </Button>
      </div>

      <MilestoneStrip
        milestones={milestones}
        today={today}
        onSelect={(m) => {
          setCursor(parseISO(m.date));
          if (compact) setSelectedDay(m.date);
        }}
      />

      <CalendarFilters
        subgroups={subgroups}
        team={team}
        subgroupIds={filters.subgroupIds}
        assigneeIds={filters.assigneeIds}
        mine={filters.mine}
        canFilterMine={userId !== null}
        onToggleSubgroup={toggleSubgroup}
        onToggleAssignee={toggleAssignee}
        onToggleMine={toggleMine}
      />

      <MonthGrid
        layouts={layouts}
        tasks={visible}
        milestones={milestones}
        maxLanes={MAX_LANES}
        monthKey={monthKey}
        today={today}
        compact={compact}
        selectedDay={selectedDay}
        dragging={dragTaskId !== null}
        onDayClick={openDay}
        onTaskClick={(task) => setDialog({ task })}
        onMilestoneClick={(m) => setMilestoneDialog({ milestone: m, defaultDate: m.date })}
        onTaskDragStart={setDragTaskId}
        onDragEnd={() => setDragTaskId(null)}
        onDropTask={moveTask}
      />

      {compact && selectedDay && (
        <AgendaList
          day={selectedDay}
          tasks={tasksOnDay(visible, selectedDay)}
          milestones={milestonesOnDay(milestones, selectedDay)}
          onOpenTask={(task) => setDialog({ task })}
          onOpenMilestone={(m) => setMilestoneDialog({ milestone: m, defaultDate: m.date })}
          onAddTask={(day) => setDialog({ defaults: { dueDate: day } })}
        />
      )}

      <UnscheduledList
        tasks={unscheduled}
        onOpenTask={(task) => setDialog({ task })}
        onSchedule={(taskId, day) => patchDates(taskId, { due_date: day })}
      />

      {dialog && (
        <TaskDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          task={dialog.task}
          defaults={dialog.defaults}
          team={team}
          subgroups={subgroups}
          projects={projects}
          allTags={allTags}
          userId={userId ?? ""}
        />
      )}

      <MilestoneDialog
        state={milestoneDialog}
        onClose={() => setMilestoneDialog(null)}
        onSaved={refetchMilestones}
      />
    </div>
  );
}
