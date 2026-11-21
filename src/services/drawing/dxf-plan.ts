import type { AnalyzedHole } from "@/types/analysis";
import type { BoundingBox, Point } from "@/types/geometry";
import { DIM, ordinateBand } from "./dims";
import { fmtIn, fmtOrdinate } from "./format";
import { dedupeValues, maxDisplacement, pickScale, spreadLabels } from "./layout-math";
import { tableFootprint } from "./hole-table";
import { frameRegion } from "./sheet-frame";
import { textWidth, type Box } from "./text-metrics";

/** More distinct ordinates than this on one axis → hole table instead. */
export const MAX_ORDINATES = 12;
/** …or more than this on both axes together. */
export const MAX_TOTAL_ORDINATES = 20;
/** Labels may jog at most this far (sheet inches) from their feature. */
export const MAX_JOG = 0.6;
/** Center-to-center spacing of adjacent ordinate labels. */
export const ORD_GAP = DIM.textH + 0.07;
/** Room kept free around the view for leader callouts. */
const CALLOUT_PAD = 0.9;

export type HoleMode = "ordinate" | "table";

export interface DxfPlan {
  holeMode: HoleMode;
  /** profile corners / cutouts located by ordinates */
  profileDimensioned: boolean;
  scale: number;
  /** datum-relative ordinate values (inches), ascending, starting at 0 */
  xs: number[];
  ys: number[];
  /** free sheet area for the view and its annotations */
  region: Box;
  table: { rowsPerSet: number; width: number } | null;
  bands: { left: number; right: number; bottom: number; top: number };
  notes: string[];
}

export interface PlanInput {
  bbox: BoundingBox;
  holes: AnalyzedHole[];
  points: Point[];
  /** general notes for a given outcome (the "undimensioned" note depends on it) */
  notesFor: (profileDimensioned: boolean) => string[];
  hasCallouts: boolean;
  tableLegendLines: number;
  /** give the overall size as a far-edge ordinate instead of a linear dim */
  farEdge: { x: boolean; y: boolean };
  /** a QR cell beside the title block narrows the notes */
  qr?: boolean;
}

/**
 * Datum-relative ordinate values along one axis: always the 0 datum, never
 * the far edge (the overall dimension already gives it).
 */
export function ordinateValues(coords: number[], min: number, extent: number): number[] {
  const rel = coords.map((c) => c - min).filter((v) => v > 0.0005 && v < extent - 0.0005);
  return dedupeValues([0, ...rel]);
}

/** Can these ordinates be printed at `scale` without crowding? */
export function ordinatesLegible(values: number[], scale: number, extent: number): boolean {
  if (values.length > MAX_ORDINATES) return false;
  const desired = values.map((v) => v * scale);
  const placed = spreadLabels(desired, ORD_GAP, -0.25, extent * scale + 0.25);
  return placed !== null && maxDisplacement(desired, placed) <= MAX_JOG;
}

const PLANS: [HoleMode, boolean][] = [
  ["ordinate", true],
  ["table", true],
  ["ordinate", false],
  ["table", false],
];

/**
 * Choose how to dimension: everything by ordinates if legible, else a hole
 * table, else leave profile details to the CAD-file note. First legible plan
 * wins; the last one is always accepted.
 */
export function planDxf(input: PlanInput): DxfPlan {
  const { bbox, holes, points } = input;
  const W = bbox.width;
  const H = bbox.height;
  let last: DxfPlan | null = null;

  for (const [holeMode, profileDimensioned] of PLANS) {
    if (holeMode === "table" && holes.length === 0) continue;
    const xCoords = [
      ...(holeMode === "ordinate" ? holes.map((h) => h.center.x) : []),
      ...(profileDimensioned ? points.map((p) => p.x) : []),
    ];
    const yCoords = [
      ...(holeMode === "ordinate" ? holes.map((h) => h.center.y) : []),
      ...(profileDimensioned ? points.map((p) => p.y) : []),
    ];
    let xs = ordinateValues(xCoords, bbox.min.x, W);
    let ys = ordinateValues(yCoords, bbox.min.y, H);
    if (input.farEdge.x) xs = [...xs, W];
    if (input.farEdge.y) ys = [...ys, H];
    // a lone "0" says nothing — unless a hole table needs the datum shown
    if (holeMode === "ordinate") {
      if (xs.length === 1) xs = [];
      if (ys.length === 1) ys = [];
    }
    const notes = input.notesFor(profileDimensioned);
    const region = { ...frameRegion(notes, input.qr) };

    let table: DxfPlan["table"] = null;
    if (holeMode === "table") {
      const fp = tableFootprint(holes.length, region.y1 - region.y0, input.tableLegendLines);
      table = { rowsPerSet: fp.rowsPerSet, width: fp.width };
      region.x1 -= fp.width + 0.25;
    }

    const labelW = (vals: number[]) => Math.max(0, ...vals.map((v) => textWidth(fmtOrdinate(v), DIM.textH)));
    const bands = {
      left: ys.length > 0 ? ordinateBand(labelW(ys)) : 0.2,
      bottom: xs.length > 0 ? ordinateBand(labelW(xs)) : 0.2,
      top: input.farEdge.x ? 0.25 : DIM.offset + DIM.textH / 2 + DIM.extOver + 0.05,
      right: input.farEdge.y ? 0.25 : DIM.offset + textWidth(fmtIn(H), DIM.textH) / 2 + 0.1,
    };
    const pad = input.hasCallouts ? CALLOUT_PAD : 0;
    const availW = region.x1 - region.x0 - bands.left - bands.right - pad;
    const availH = region.y1 - region.y0 - bands.bottom - bands.top - pad;
    const scale = pickScale(W, H, availW, availH);
    const plan: DxfPlan = { holeMode, profileDimensioned, scale, xs, ys, region, table, bands, notes };
    last = plan;
    const fits = xs.length + ys.length <= MAX_TOTAL_ORDINATES;
    if (fits && ordinatesLegible(xs, scale, W) && ordinatesLegible(ys, scale, H)) return plan;
  }
  return last!;
}
