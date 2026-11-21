import type { AnalyzedHole } from "@/types/analysis";
import type { Layer } from "./canvas";
import { fmtIn } from "./format";
import { line, pt, rect, text } from "./primitives";
import { DIA } from "./text-metrics";

export interface HoleRow {
  tag: string;
  hole: AnalyzedHole;
  /** datum-relative location, inches */
  x: number;
  y: number;
}

const COLS: [string, number][] = [
  ["HOLE", 0.45],
  ["X", 0.62],
  ["Y", 0.62],
  ["SIZE", 1.0],
];
const COL_W = COLS.reduce((s, [, w]) => s + w, 0);
const ROW_H = 0.19;
const HEAD_H = 0.42; // title row + column headings
const TEXT_H = 0.09;
const SET_GAP = 0.15;

/**
 * Tag holes A1, A2… by diameter group (smallest first), reading order
 * within a group (top row first, then left to right).
 */
export function tagHoles(holes: AnalyzedHole[], minX: number, minY: number): HoleRow[] {
  const groups = new Map<string, AnalyzedHole[]>();
  for (const h of [...holes].sort((a, b) => a.diameter - b.diameter)) {
    const key = h.diameter.toFixed(3);
    groups.set(key, [...(groups.get(key) ?? []), h]);
  }
  const rows: HoleRow[] = [];
  [...groups.values()].forEach((group, gi) => {
    const letter = groupLetter(gi);
    group
      .sort((a, b) => (Math.abs(a.center.y - b.center.y) > 1e-3 ? b.center.y - a.center.y : a.center.x - b.center.x))
      .forEach((h, i) =>
        rows.push({ tag: `${letter}${i + 1}`, hole: h, x: h.center.x - minX, y: h.center.y - minY }),
      );
  });
  return rows;
}

/** A…Z, then AA, AB… */
function groupLetter(i: number): string {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return i < 26 ? a[i] : a[Math.floor(i / 26) - 1] + a[i % 26];
}

/** Columns of rows needed to fit `count` rows in `height`; total width. */
export function tableFootprint(count: number, height: number, legendLines: number) {
  const usable = height - HEAD_H - legendLines * 0.15 - 0.1;
  const rowsPerSet = Math.max(1, Math.floor(usable / ROW_H));
  const sets = Math.max(1, Math.ceil(count / rowsPerSet));
  return { rowsPerSet, sets, width: sets * COL_W + (sets - 1) * SET_GAP };
}

/** Draw the hole table with its top-right corner at (right, top). */
export function drawHoleTable(
  layer: Layer,
  rows: HoleRow[],
  right: number,
  top: number,
  rowsPerSet: number,
  legend: string[],
) {
  const sets = Math.max(1, Math.ceil(rows.length / rowsPerSet));
  const left = right - (sets * COL_W + (sets - 1) * SET_GAP);
  layer.text(text("HOLE TABLE", pt((left + right) / 2, top - 0.05), 0.1, { align: "center", valign: "top", bold: true }));
  let lowest = top;
  for (let s = 0; s < sets; s++) {
    const chunk = rows.slice(s * rowsPerSet, (s + 1) * rowsPerSet);
    const x0 = left + s * (COL_W + SET_GAP);
    const headTop = top - 0.22;
    const bottom = headTop - ROW_H * (chunk.length + 1);
    layer.path(rect(x0, bottom, COL_W, headTop - bottom, "thin"));
    let x = x0;
    for (const [label, w] of COLS) {
      layer.text(text(label, pt(x + w / 2, headTop - ROW_H / 2), TEXT_H, { align: "center", valign: "middle", bold: true }));
      x += w;
      if (x < x0 + COL_W - 1e-6) layer.path(line(pt(x, bottom), pt(x, headTop), "thin"));
    }
    chunk.forEach((r, i) => {
      const yLine = headTop - ROW_H * (i + 1);
      layer.path(line(pt(x0, yLine), pt(x0 + COL_W, yLine), "thin"));
      const cells = [r.tag, fmtIn(r.x), fmtIn(r.y), `${DIA}${fmtIn(r.hole.diameter)} THRU`];
      let cx = x0;
      cells.forEach((c, j) => {
        const w = COLS[j][1];
        layer.text(text(c, pt(cx + w / 2, yLine - ROW_H / 2), TEXT_H, { align: "center", valign: "middle" }));
        cx += w;
      });
    });
    lowest = Math.min(lowest, bottom);
  }
  legend.forEach((l, i) => {
    layer.text(text(l, pt(left, lowest - 0.12 - i * 0.15), 0.075, { valign: "top" }));
  });
}
