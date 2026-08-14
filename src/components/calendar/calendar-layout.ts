import { eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";

/** Anything the layout needs: an id plus the two plain `yyyy-MM-dd` date columns. */
export interface DatedTask {
  id: string;
  start_date: string | null;
  due_date: string | null;
}

/** Inclusive day range, both ends `yyyy-MM-dd`. */
export interface TaskRange {
  start: string;
  end: string;
}

/** One task's slice of a single week row. */
export interface Segment {
  taskId: string;
  /** 0-6, inclusive */
  colStart: number;
  /** 0-6, inclusive */
  colEnd: number;
  lane: number;
  /** the bar started in an earlier week — keep the left edge square */
  continuesLeft: boolean;
  /** the bar runs into the next week — keep the right edge square */
  continuesRight: boolean;
}

export interface WeekLayout {
  /** the week's seven `yyyy-MM-dd` keys, Sunday first */
  days: string[];
  segments: Segment[];
  /** per column (0-6), ids of tasks that did not fit in `maxLanes` */
  overflow: string[][];
}

/** Local `Date` → `yyyy-MM-dd`. Formats in local time, so the day never shifts. */
export function toDayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Sunday-start weeks covering the cursor's whole month, as `yyyy-MM-dd` strings. */
export function buildMonthMatrix(cursor: Date): string[][] {
  const from = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
  const to = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: from, end: to }).map(toDayKey);
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/** The inclusive day span a task occupies, or null when it has no dates at all. */
export function taskRange(task: DatedTask): TaskRange | null {
  const start = task.start_date;
  const due = task.due_date;
  if (start && due) return start <= due ? { start, end: due } : { start: due, end: start };
  const only = start ?? due;
  return only ? { start: only, end: only } : null;
}

/** True when the task has neither date — it belongs in the Unscheduled list. */
export function isUnscheduled(task: DatedTask): boolean {
  return taskRange(task) === null;
}

/** Every task whose span covers `day`, input order preserved. */
export function tasksOnDay<T extends DatedTask>(tasks: T[], day: string): T[] {
  return tasks.filter((task) => {
    const range = taskRange(task);
    return range !== null && range.start <= day && day <= range.end;
  });
}

/**
 * Pack one week row: clip every intersecting task to the week, then greedily
 * first-fit each clipped span into the lowest lane it does not collide in.
 * Anything past `maxLanes` is reported per-day in `overflow` instead.
 */
export function computeWeekLayout<T extends DatedTask>(
  tasks: T[],
  days: string[],
  maxLanes = 3,
): WeekLayout {
  const first = days[0];
  const last = days[days.length - 1];

  const clipped = tasks
    .map((task) => ({ task, range: taskRange(task) }))
    .filter(
      (entry): entry is { task: T; range: TaskRange } =>
        entry.range !== null && entry.range.start <= last && entry.range.end >= first,
    )
    .map(({ task, range }) => {
      const startIdx = days.indexOf(range.start);
      const endIdx = days.indexOf(range.end);
      return {
        taskId: task.id,
        colStart: startIdx === -1 ? 0 : startIdx,
        colEnd: endIdx === -1 ? days.length - 1 : endIdx,
        continuesLeft: startIdx === -1,
        continuesRight: endIdx === -1,
      };
    })
    .sort(
      (a, b) =>
        a.colStart - b.colStart ||
        b.colEnd - b.colStart - (a.colEnd - a.colStart) ||
        a.taskId.localeCompare(b.taskId),
    );

  const segments: Segment[] = [];
  const overflow: string[][] = days.map(() => []);
  const laneEnds: number[] = []; // last column occupied, per lane

  for (const entry of clipped) {
    let lane = 0;
    while (lane < laneEnds.length && laneEnds[lane] >= entry.colStart) lane++;
    if (lane >= maxLanes) {
      for (let col = entry.colStart; col <= entry.colEnd; col++) overflow[col].push(entry.taskId);
      continue;
    }
    laneEnds[lane] = entry.colEnd;
    segments.push({ ...entry, lane });
  }

  return { days, segments, overflow };
}

/** `computeWeekLayout` across a whole month matrix. */
export function computeMonthLayout<T extends DatedTask>(
  tasks: T[],
  matrix: string[][],
  maxLanes = 3,
): WeekLayout[] {
  return matrix.map((days) => computeWeekLayout(tasks, days, maxLanes));
}
