import type { ModelFeatures } from "@/services/dimensions/model-features";
import type { Layer } from "./canvas";
import { CalloutPlacer, circleAnchors } from "./callouts";
import { centerDashes, centerMark, DIM, linearDim, ordinateDim } from "./dims";
import { ORD_GAP } from "./dxf-plan";
import { extremeAlong } from "./dxf-view";
import { fmtOrdinate } from "./format";
import { edgeText, pitchTexts } from "./hole-grid";
import { dedupeValues, spreadLabels } from "./layout-math";
import type { AxisDim, SeenHole, ViewHolePlan } from "./model-hole-plan";
export type { SeenHole };
import { project, v3, viewPolys, type PlacedView } from "./model-views";
import { line, polar, pt, type Pt } from "./primitives";
import type { Box } from "./text-metrics";

export type Side = "below" | "above" | "left" | "right";

/**
 * How far out (sheet inches from the view's edge) each side's dimensions
 * already reach, values included. The next dimension stacks beyond it, so
 * a wide value beside a vertical line never meets the next line out.
 */
export class DimLevels {
  private reach = new Map<string, number>();
  extent(view: string, side: Side): number {
    return this.reach.get(`${view}:${side}`) ?? 0;
  }
  extend(view: string, side: Side, distance: number) {
    this.reach.set(`${view}:${side}`, Math.max(this.extent(view, side), distance));
  }
}

/** Spacing between stacked dimension lines (and from the last value out). */
const ROW_GAP = 0.35;
export const levelOffset = (k: number) => DIM.offset + ROW_GAP * k;

/**
 * Place a linear dimension on the first free row of a side, trying each
 * text form (longest first) before moving outward a row.
 */
export function placeSideDim(
  layer: Layer, region: Box, levels: DimLevels, pv: PlacedView, side: Side, a: Pt, b: Pt, texts: string[],
  /** where a tight span's value may go, in order of preference */
  tight: ("side" | "start" | "end")[] = ["side", "end", "start"],
  /** where along a vertical line the value may break it (0..1, preferred first) */
  fracs: number[] = [0.5, 0.3, 0.7, 0.15, 0.85],
): boolean {
  const { box } = pv;
  const reached = levels.extent(pv.key, side);
  const start = reached > 0 ? Math.max(DIM.offset, reached + 0.22) : DIM.offset;
  const axis = side === "below" || side === "above" ? "h" : "v";
  // distance of a shape box from the view edge on this side
  const dist = (e: Box) => (side === "below" ? box.y0 - e.y0 : side === "above" ? e.y1 - box.y1 : side === "left" ? box.x0 - e.x0 : e.x1 - box.x1);
  for (let tries = 0; tries < 4; tries++) {
    const off = start + ROW_GAP * tries;
    const at = side === "below" ? box.y0 - off : side === "above" ? box.y1 + off : side === "left" ? box.x0 - off : box.x1 + off;
    for (const t of texts) {
      for (const where of tight) {
        // the value may slide along a long line to clear other extension lines
        for (const frac of axis === "v" ? fracs : [0.5]) {
          const e = layer.tryAdd(region, (l) => linearDim(l, a, b, axis, at, t, frac, where));
          if (e) {
            levels.extend(pv.key, side, dist(e));
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Draw one view's hole locations: center lines / marks, pattern dimensions
 * (edge distance + pitch) or ordinates. Returns whether all were placed.
 */
export function drawViewHoles(
  layer: Layer, region: Box, levels: DimLevels, pv: PlacedView,
  plan: ViewHolePlan, f: ModelFeatures, sides: { u: Side; v: Side },
): boolean {
  const s = pv.scale;
  const P = (h: SeenHole) => project(pv, h.center);
  const r = (h: SeenHole) => (h.diameter / 2) * s;
  let ok = true;

  // marks: center lines through grid rows/columns for bigger grids, else center marks
  const gridHoles = new Set(plan.dims.flatMap((d) => d.holes));
  const bigGrid = plan.dims.length > 0 && gridHoles.size >= 4;
  if (bigGrid) centerLines(layer, plan.dims[0].holes.map(P), Math.max(...plan.holes.map(r)));
  for (const h of plan.holes) if (!bigGrid || !gridHoles.has(h)) centerMark(layer, P(h), r(h));
  for (const pat of f.holes) {
    if (pat.boltCircle && pat.stacks.every((k) => plan.holes.some((h) => h.stack === k))) {
      boltCircleLine(layer, project(pv, v3(pat.boltCircle.center)), (pat.boltCircle.diameter / 2) * s);
    }
  }

  const polys = viewPolys(pv);
  for (const d of plan.dims) ok = dimAxis(layer, region, levels, pv, polys, d, d.dir === "u" ? sides.u : sides.v) && ok;
  if (plan.ordinates) ok = ordinates(layer, pv, polys, plan, f, sides) && ok;
  return ok && !plan.unlocated;
}

/** Leader callouts for a view's holes — after every fixed dimension is down. */
export function calloutViewHoles(placer: CalloutPlacer, pv: PlacedView, plan: ViewHolePlan): boolean {
  let ok = true;
  for (const c of plan.callouts) {
    const anchors = c.holes.flatMap((h) => circleAnchors(project(pv, h.center), (h.diameter / 2) * pv.scale));
    if (!placer.place(c.lines, anchors)) ok = false;
  }
  return ok;
}

/**
 * Datum edge → nearest row/column, then the pitch to the next, on
 * successive rows. Values come straight from the shared pattern analysis.
 */
function dimAxis(layer: Layer, region: Box, levels: DimLevels, pv: PlacedView, polys: Pt[][], ad: AxisDim, side: Side): boolean {
  const s = pv.scale, { box } = pv, { d } = ad;
  const horizontal = ad.dir === "u";
  const [lo, hi] = horizontal ? [pv.view.minU, pv.view.maxU] : [pv.view.minV, pv.view.maxV];
  const sheet0 = horizontal ? box.x0 : box.y0;
  const toSheet = (viewCoord: number) => sheet0 + (viewCoord - lo) * s;
  // datum edge in view coordinates; the pattern runs away from it
  const edgeView = ad.sign * d.datumAt;
  const away = Math.abs(edgeView - lo) <= Math.abs(edgeView - hi) ? 1 : -1;
  const firstPos = toSheet(edgeView + away * d.edgeDistance);
  const outward = side === "below" || side === "left" ? -1 : 1;
  const along = (p: Pt) => (horizontal ? p.x : p.y);
  // hole in that row/column nearest the side the dimension sits on
  const featureAt = (pos: number): Pt => {
    const inLine = ad.holes.map((h) => project(pv, h.center)).filter((p) => Math.abs(along(p) - pos) < 0.01);
    const rr = (ad.holes[0].diameter / 2) * s;
    if (inLine.length === 0) return horizontal ? pt(pos, outward < 0 ? box.y0 : box.y1) : pt(outward < 0 ? box.x0 : box.x1, pos);
    const p = inLine.reduce((m, q) => ((horizontal ? q.y - m.y : q.x - m.x) * outward > 0 ? q : m));
    return horizontal ? pt(p.x, p.y + outward * rr) : pt(p.x + outward * rr, p.y);
  };
  const edgeSheet = toSheet(edgeView);
  const edge = horizontal
    ? pt(edgeSheet, extremeAlong(polys, "x", edgeSheet, outward < 0 ? "min" : "max") ?? (outward < 0 ? box.y0 : box.y1))
    : pt(extremeAlong(polys, "y", edgeSheet, outward < 0 ? "min" : "max") ?? (outward < 0 ? box.x0 : box.x1), edgeSheet);
  // tight values: horizontal rows put them in line past the edge / past the
  // second hole (so later extension lines stay clear); vertical rows beside the line
  const [beyondEdge, beyondPattern] = away > 0 ? (["start", "end"] as const) : (["end", "start"] as const);
  const edgePrefs = horizontal ? [beyondEdge, "side", beyondPattern] as const : ["side", beyondPattern, beyondEdge] as const;
  const pitchPrefs = horizontal ? [beyondPattern, "side"] as const : ["side", beyondPattern] as const;
  let ok = placeSideDim(layer, region, levels, pv, side, edge, featureAt(firstPos), edgeText(d.edgeDistance), [...edgePrefs]);
  if (d.count > 1) {
    const second = featureAt(firstPos + away * d.pitch * s);
    ok = placeSideDim(layer, region, levels, pv, side, featureAt(firstPos), second, pitchTexts(d), [...pitchPrefs]) && ok;
  }
  return ok;
}

/** Bolt circle drawn as a long-dash/short-dash center line. */
function boltCircleLine(layer: Layer, c: Pt, R: number) {
  for (const [a, b] of centerDashes(0, 2 * Math.PI * R)) {
    const steps = Math.max(2, Math.ceil(((b - a) / R) * 8));
    for (let i = 0; i < steps; i++) {
      layer.path(line(polar(c, R, (a + ((b - a) * i) / steps) / R), polar(c, R, (a + ((b - a) * (i + 1)) / steps) / R)));
    }
  }
}

/** Long-dash center lines through each grid column and row, 1/8" past the holes. */
function centerLines(layer: Layer, pts: Pt[], r: number) {
  const ext = r + 0.125;
  const xs = dedupeValues(pts.map((p) => p.x), 0.005), ys = dedupeValues(pts.map((p) => p.y), 0.005);
  const [x0, x1] = [Math.min(...xs) - ext, Math.max(...xs) + ext];
  const [y0, y1] = [Math.min(...ys) - ext, Math.max(...ys) + ext];
  for (const x of xs) for (const [a, b] of centerDashes(0, y1 - y0)) layer.path(line(pt(x, y0 + a), pt(x, y0 + b)));
  for (const y of ys) for (const [a, b] of centerDashes(0, x1 - x0)) layer.path(line(pt(x0 + a, y), pt(x0 + b, y)));
}

/** Ordinates from the view's low corner when holes don't form a grid; bolt circles by their center. */
function ordinates(layer: Layer, pv: PlacedView, polys: Pt[][], plan: ViewHolePlan, f: ModelFeatures, sides: { u: Side; v: Side }): boolean {
  const s = pv.scale, { box } = pv;
  const pts: { p: Pt; r: number }[] = [];
  const bc = new Set<number>();
  for (const pat of f.holes) {
    if (pat.boltCircle && pat.stacks.every((k) => plan.holes.some((h) => h.stack === k))) {
      pts.push({ p: project(pv, v3(pat.boltCircle.center)), r: 0.06 });
      for (const k of pat.stacks) bc.add(k);
    }
  }
  for (const h of plan.holes) if (!bc.has(h.stack)) pts.push({ p: project(pv, h.center), r: (h.diameter / 2) * s });
  // the far edges are ordinates too: they give the overall size on this view
  const W = (box.x1 - box.x0) / s, H = (box.y1 - box.y0) / s;
  const xs = [...dedupeValues([0, ...pts.map((q) => (q.p.x - box.x0) / s)]).filter((x) => x < W - 0.0005), W];
  const ys = [...dedupeValues([0, ...pts.map((q) => (q.p.y - box.y0) / s)]).filter((y) => y < H - 0.0005), H];
  const px = spreadLabels(xs.map((x) => box.x0 + x * s), ORD_GAP, box.x0 - 0.25, box.x1 + 0.25);
  const py = spreadLabels(ys.map((y) => box.y0 + y * s), ORD_GAP, box.y0 - 0.25, box.y1 + 0.25);
  if (!px || !py) return false;
  const up = sides.u === "above", right = sides.v === "right";
  const gap = DIM.extGap;
  xs.forEach((x, i) => {
    const X = box.x0 + x * s;
    const starts = pts.filter((q) => Math.abs(q.p.x - X) < 1e-4).map((q) => q.p.y + (up ? q.r + gap : -q.r - gap));
    if (x === 0 || x === W) starts.push((extremeAlong(polys, "x", X, up ? "max" : "min") ?? (up ? box.y1 : box.y0)) + (up ? gap : -gap));
    ordinateDim(layer, up ? "x-above" : "x", pt(X, up ? Math.max(...starts) : Math.min(...starts)), up ? box.y1 : box.y0, px[i], fmtOrdinate(x));
  });
  ys.forEach((y, i) => {
    const Y = box.y0 + y * s;
    const starts = pts.filter((q) => Math.abs(q.p.y - Y) < 1e-4).map((q) => q.p.x + (right ? q.r + gap : -q.r - gap));
    if (y === 0 || y === H) starts.push((extremeAlong(polys, "y", Y, right ? "max" : "min") ?? (right ? box.x1 : box.x0)) + (right ? gap : -gap));
    ordinateDim(layer, right ? "y-right" : "y", pt(right ? Math.max(...starts) : Math.min(...starts), Y), right ? box.x1 : box.x0, py[i], fmtOrdinate(y));
  });
  return true;
}
