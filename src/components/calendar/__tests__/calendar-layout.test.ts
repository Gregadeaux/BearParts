import { describe, expect, it } from "vitest";
import {
  buildMonthMatrix,
  computeMonthLayout,
  computeWeekLayout,
  isUnscheduled,
  taskRange,
  tasksOnDay,
  toDayKey,
  type DatedTask,
} from "../calendar-layout";

function task(id: string, start_date: string | null, due_date: string | null): DatedTask {
  return { id, start_date, due_date };
}

// Sun 2026-08-09 .. Sat 2026-08-15
const WEEK = ["2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15"];

describe("toDayKey / buildMonthMatrix", () => {
  it("formats a local date without shifting the day", () => {
    expect(toDayKey(new Date(2026, 7, 1))).toBe("2026-08-01");
    expect(toDayKey(new Date(2026, 0, 31, 23, 59))).toBe("2026-01-31");
  });

  it("builds Sunday-start weeks covering the whole month", () => {
    const matrix = buildMonthMatrix(new Date(2026, 7, 12));
    expect(matrix).toHaveLength(6);
    expect(matrix.every((w) => w.length === 7)).toBe(true);
    expect(matrix[0][0]).toBe("2026-07-26"); // Aug 1 2026 is a Saturday
    expect(matrix.at(-1)?.at(-1)).toBe("2026-09-05");
    expect(matrix[2]).toEqual(WEEK);
  });

  it("emits fewer rows for a month that aligns to whole weeks", () => {
    // Feb 2026 starts on a Sunday and ends on a Saturday — exactly four rows.
    expect(buildMonthMatrix(new Date(2026, 1, 10))).toHaveLength(4);
    expect(buildMonthMatrix(new Date(2026, 8, 10))).toHaveLength(5); // Sep 2026
  });
});

describe("taskRange", () => {
  it("treats a due-only or start-only task as a single day", () => {
    expect(taskRange(task("a", null, "2026-08-12"))).toEqual({ start: "2026-08-12", end: "2026-08-12" });
    expect(taskRange(task("b", "2026-08-12", null))).toEqual({ start: "2026-08-12", end: "2026-08-12" });
  });

  it("spans start..due and normalizes an inverted pair", () => {
    expect(taskRange(task("c", "2026-08-10", "2026-08-14"))).toEqual({ start: "2026-08-10", end: "2026-08-14" });
    expect(taskRange(task("d", "2026-08-14", "2026-08-10"))).toEqual({ start: "2026-08-10", end: "2026-08-14" });
  });

  it("reports no dates as unscheduled", () => {
    expect(taskRange(task("e", null, null))).toBeNull();
    expect(isUnscheduled(task("e", null, null))).toBe(true);
    expect(isUnscheduled(task("f", null, "2026-08-12"))).toBe(false);
  });
});

describe("tasksOnDay", () => {
  it("matches spans by plain string comparison across a month boundary", () => {
    const tasks = [
      task("span", "2026-07-30", "2026-08-03"),
      task("due", null, "2026-08-03"),
      task("other", null, "2026-08-04"),
    ];
    expect(tasksOnDay(tasks, "2026-08-01").map((t) => t.id)).toEqual(["span"]);
    expect(tasksOnDay(tasks, "2026-08-03").map((t) => t.id)).toEqual(["span", "due"]);
    expect(tasksOnDay(tasks, "2026-08-04").map((t) => t.id)).toEqual(["other"]);
  });
});

describe("computeWeekLayout", () => {
  it("places a single-day chip in one column on lane 0", () => {
    const { segments, overflow } = computeWeekLayout([task("a", null, "2026-08-12")], WEEK);
    expect(segments).toEqual([
      { taskId: "a", colStart: 3, colEnd: 3, lane: 0, continuesLeft: false, continuesRight: false },
    ]);
    expect(overflow.every((o) => o.length === 0)).toBe(true);
  });

  it("ignores tasks outside the week and unscheduled tasks", () => {
    const layout = computeWeekLayout([task("a", null, "2026-09-01"), task("b", null, null)], WEEK);
    expect(layout.segments).toEqual([]);
  });

  it("clips a bar that starts before the week and squares that edge", () => {
    const [seg] = computeWeekLayout([task("a", "2026-08-05", "2026-08-11")], WEEK).segments;
    expect(seg).toMatchObject({ colStart: 0, colEnd: 2, continuesLeft: true, continuesRight: false });
  });

  it("clips a bar that runs past the week and squares that edge", () => {
    const [seg] = computeWeekLayout([task("a", "2026-08-13", "2026-08-20")], WEEK).segments;
    expect(seg).toMatchObject({ colStart: 4, colEnd: 6, continuesLeft: false, continuesRight: true });
  });

  it("splits a multi-week bar into per-week segments with square inner edges", () => {
    const matrix = buildMonthMatrix(new Date(2026, 7, 12));
    const weeks = computeMonthLayout([task("a", "2026-08-05", "2026-08-19")], matrix);
    const segs = weeks.flatMap((w) => w.segments);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({ colStart: 3, colEnd: 6, continuesLeft: false, continuesRight: true });
    expect(segs[1]).toMatchObject({ colStart: 0, colEnd: 6, continuesLeft: true, continuesRight: true });
    expect(segs[2]).toMatchObject({ colStart: 0, colEnd: 3, continuesLeft: true, continuesRight: false });
  });

  it("packs overlapping spans into stacked lanes and reuses a freed lane", () => {
    const { segments } = computeWeekLayout(
      [
        task("long", "2026-08-09", "2026-08-11"),
        task("mid", "2026-08-10", "2026-08-12"),
        task("late", "2026-08-13", "2026-08-13"),
      ],
      WEEK,
    );
    const lanes = Object.fromEntries(segments.map((s) => [s.taskId, s.lane]));
    expect(lanes).toEqual({ long: 0, mid: 1, late: 0 });
  });

  it("keeps a lane reserved for the bar's full span", () => {
    const { segments } = computeWeekLayout(
      [task("bar", "2026-08-09", "2026-08-15"), task("chip", null, "2026-08-13")],
      WEEK,
    );
    expect(segments.find((s) => s.taskId === "chip")?.lane).toBe(1);
  });

  it("overflows past maxLanes and reports the ids per covered day", () => {
    const tasks = [
      task("wide", "2026-08-12", "2026-08-13"), // widest at col 3 — packed first
      task("a", null, "2026-08-12"),
      task("b", null, "2026-08-12"),
      task("c", null, "2026-08-12"),
    ];
    const { segments, overflow } = computeWeekLayout(tasks, WEEK);
    expect(segments.map((s) => s.taskId)).toEqual(["wide", "a", "b"]);
    expect(overflow[3]).toEqual(["c"]);
    expect(overflow[0]).toEqual([]);
  });

  it("reports an overflowing bar on every day it covers", () => {
    const full = ["w1", "w2", "w3"].map((id) => task(id, "2026-08-09", "2026-08-15"));
    const { overflow } = computeWeekLayout([...full, task("late", "2026-08-12", "2026-08-14")], WEEK);
    expect(overflow[3]).toEqual(["late"]);
    expect(overflow[4]).toEqual(["late"]);
    expect(overflow[5]).toEqual(["late"]);
    expect(overflow[6]).toEqual([]);
  });

  it("honours a custom lane cap", () => {
    const tasks = [task("a", null, "2026-08-12"), task("b", null, "2026-08-12")];
    const { segments, overflow } = computeWeekLayout(tasks, WEEK, 1);
    expect(segments).toHaveLength(1);
    expect(overflow[3]).toHaveLength(1);
  });

  it("orders lanes deterministically: earliest start, then widest, then id", () => {
    const { segments } = computeWeekLayout(
      [
        task("zz", "2026-08-09", "2026-08-09"),
        task("aa", "2026-08-09", "2026-08-09"),
        task("wide", "2026-08-09", "2026-08-14"),
      ],
      WEEK,
    );
    expect(segments.map((s) => s.taskId)).toEqual(["wide", "aa", "zz"]);
    expect(segments.map((s) => s.lane)).toEqual([0, 1, 2]);
  });
});

describe("computeMonthLayout", () => {
  it("returns one layout per week row", () => {
    const matrix = buildMonthMatrix(new Date(2026, 7, 12));
    const layouts = computeMonthLayout([], matrix);
    expect(layouts).toHaveLength(matrix.length);
    expect(layouts[0].days).toEqual(matrix[0]);
  });
});
