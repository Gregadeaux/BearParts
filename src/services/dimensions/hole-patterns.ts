/**
 * Hole patterns — rows and rectangular grids of equal holes with uniform
 * pitch, measured from the part's bounding edges. One API for 3D models
 * (ModelFeatures) and DXF parts (DxfAnalysis), shared by the drawing sheet
 * and the verify flow so both report the same spacing and edge distances.
 *
 * Pure and isomorphic (no React / three / jsPDF). Everything in inches.
 */

import type { DxfAnalysis } from "@/types/analysis";
import type { ModelFeatures, Vec3 } from "./model-features";

/** Positions within this are the same row/column; pitches must agree to it. */
export const PATTERN_TOL_IN = 0.002;

export interface PatternDirection {
  /** unit direction the holes repeat along (model or DXF coordinates) */
  dir: Vec3;
  /** holes along this direction */
  count: number;
  /** center-to-center spacing; 0 when `count` is 1 */
  pitch: number;
  /** bounding edge the pattern is measured from: the nearer one (ties → "min") */
  datum: "min" | "max";
  /** coordinate of that edge along `dir` */
  datumAt: number;
  /** datum edge → nearest hole center */
  edgeDistance: number;
  /** farthest hole center → the opposite edge (derivable from the overall size) */
  farEdgeDistance: number;
}

export interface HolePatternSet {
  source: "model" | "dxf";
  /** single = 1 hole; row = 1×N; grid = M×N; irregular = equal holes not on a uniform grid */
  kind: "single" | "row" | "grid" | "irregular";
  diameter: number;
  /** physical holes in the set — a hole through both walls of a tube counts once */
  count: number;
  /** hole axis (unit); DXF: (0, 0, 1) */
  axis: Vec3;
  /** 3D: the face the holes open into on the +axis side (plane n·p = offset); DXF: null */
  face: { normal: Vec3; offset: number } | null;
  /** [along the face's longer extent, across it]; null when irregular */
  directions: [PatternDirection, PatternDirection] | null;
  /** hole centers on `face` (DXF: z = 0), sorted by directions[1] then directions[0] */
  centers: Vec3[];
  /** 3D: indices into ModelFeatures.stacks; DXF: indices into DxfAnalysis.holes (same order as centers) */
  holes: number[];
  /** every hole open through the whole part (DXF: always true) */
  throughPart: boolean;
}

type V = [number, number, number];
const toV = (p: Vec3): V => [p.x, p.y, p.z];
const vec = (a: V): Vec3 => ({ x: a[0], y: a[1], z: a[2] });
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Physical holes of a model grouped by diameter, axis and the face they open
 * into, each analyzed as a pattern measured from the model's bounding box.
 */
export function modelHolePatterns(f: ModelFeatures): HolePatternSet[] {
  const groups = new Map<string, number[]>();
  f.stacks.forEach((s, k) => {
    const key = [s.axis.x, s.axis.y, s.axis.z].map((v) => v.toFixed(3)).join() + `|${s.diameter.toFixed(3)}|${s.extent[1].toFixed(2)}`;
    groups.set(key, [...(groups.get(key) ?? []), k]);
  });
  const lo = toV(f.bounds.min), hi = toV(f.bounds.max);
  return [...groups.values()].map((ks) => {
    const s0 = f.stacks[ks[0]];
    const axis = toV(s0.axis);
    const [e1, e2] = inPlaneAxes(axis, lo, hi);
    const range = (e: V): [number, number] => {
      const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => dot([i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]], e));
      return [Math.min(...corners), Math.max(...corners)];
    };
    const top = Math.max(...ks.map((k) => f.stacks[k].extent[1]));
    const pts = ks.map((k) => {
      const s = f.stacks[k];
      const c = toV(s.center);
      return { k, x: dot(c, e1), y: dot(c, e2), p: vec([c[0] + axis[0] * s.extent[1], c[1] + axis[1] * s.extent[1], c[2] + axis[2] * s.extent[1]]) };
    });
    return analyze("model", pts, e1, e2, range(e1), range(e2), s0.diameter, vec(axis), { normal: vec(axis), offset: top },
      ks.every((k) => f.stacks[k].throughPart));
  });
}

/** DXF holes grouped by diameter, measured from the profile's bounding box. */
export function dxfHolePatterns(a: DxfAnalysis): HolePatternSet[] {
  const { min, max, width, height } = a.boundingBox;
  const [e1, e2]: [V, V] = width >= height ? [[1, 0, 0], [0, 1, 0]] : [[0, 1, 0], [1, 0, 0]];
  const groups = new Map<string, number[]>();
  a.holes.forEach((h, i) => groups.set(h.diameter.toFixed(3), [...(groups.get(h.diameter.toFixed(3)) ?? []), i]));
  return [...groups.values()].map((idx) => {
    const pts = idx.map((i) => {
      const c: V = [a.holes[i].center.x, a.holes[i].center.y, 0];
      return { k: i, x: dot(c, e1), y: dot(c, e2), p: vec(c) };
    });
    const r = (e: V): [number, number] => (e[0] ? [min.x, max.x] : [min.y, max.y]);
    return analyze("dxf", pts, e1, e2, r(e1), r(e2), a.holes[idx[0]].diameter, { x: 0, y: 0, z: 1 }, null, true);
  });
}

function analyze(
  source: HolePatternSet["source"], pts: { k: number; x: number; y: number; p: Vec3 }[], e1: V, e2: V,
  r1: [number, number], r2: [number, number], diameter: number, axis: Vec3, face: HolePatternSet["face"], throughPart: boolean,
): HolePatternSet {
  const sorted = [...pts].sort((a, b) => (Math.abs(a.y - b.y) > PATTERN_TOL_IN ? a.y - b.y : a.x - b.x));
  const grid = detectGrid(sorted);
  const base = { source, diameter, count: pts.length, axis, face, centers: sorted.map((q) => q.p), holes: sorted.map((q) => q.k), throughPart };
  if (!grid) return { ...base, kind: "irregular", directions: null };
  const kind = grid.cols.count === 1 && grid.rows.count === 1 ? "single" : grid.cols.count === 1 || grid.rows.count === 1 ? "row" : "grid";
  return { ...base, kind, directions: [direction(e1, grid.cols, r1), direction(e2, grid.rows, r2)] };
}

function direction(e: V, g: GridAxis, [lo, hi]: [number, number]): PatternDirection {
  const low = g.first - lo;
  const high = hi - (g.first + (g.count - 1) * g.pitch);
  const fromMin = low <= high + PATTERN_TOL_IN;
  return {
    dir: vec(e), count: g.count, pitch: g.pitch,
    datum: fromMin ? "min" : "max", datumAt: fromMin ? lo : hi,
    edgeDistance: fromMin ? low : high, farEdgeDistance: fromMin ? high : low,
  };
}

/** The two in-face directions: model axes when the hole axis is one, longer extent first. */
function inPlaneAxes(axis: V, lo: V, hi: V): [V, V] {
  const k = [0, 1, 2].findIndex((i) => Math.abs(axis[i]) > 0.9999);
  if (k >= 0) {
    const [i, j] = [0, 1, 2].filter((m) => m !== k);
    const unit = (m: number): V => [m === 0 ? 1 : 0, m === 1 ? 1 : 0, m === 2 ? 1 : 0];
    return hi[i] - lo[i] >= hi[j] - lo[j] - 1e-9 ? [unit(i), unit(j)] : [unit(j), unit(i)];
  }
  const u = norm(Math.abs(axis[0]) < 0.9 ? cross(axis, [1, 0, 0]) : cross(axis, [0, 1, 0]));
  return [u, cross(axis, u)];
}

export interface GridAxis {
  first: number;
  pitch: number;
  count: number;
}

/** Cluster values within `tol` (cluster mean), ascending. */
export function clusterValues(values: number[], tol = PATTERN_TOL_IN): number[] {
  const out: { sum: number; n: number }[] = [];
  for (const v of [...values].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && v - last.sum / last.n <= tol) {
      last.sum += v;
      last.n++;
    } else out.push({ sum: v, n: 1 });
  }
  return out.map((c) => c.sum / c.n);
}

/** Evenly spaced values → first/pitch/count; null if spacing isn't uniform. */
export function uniformAxis(values: number[], tol = PATTERN_TOL_IN): GridAxis | null {
  if (values.length === 0) return null;
  if (values.length === 1) return { first: values[0], pitch: 0, count: 1 };
  const pitch = (values[values.length - 1] - values[0]) / (values.length - 1);
  if (pitch <= tol) return null;
  return values.every((v, i) => Math.abs(v - (values[0] + i * pitch)) <= tol) ? { first: values[0], pitch, count: values.length } : null;
}

/** A complete M×N grid (incl. 1×N, 1×1) with exactly one point per node, else null. */
export function detectGrid(pts: { x: number; y: number }[], tol = PATTERN_TOL_IN): { cols: GridAxis; rows: GridAxis } | null {
  if (pts.length === 0) return null;
  const cols = uniformAxis(clusterValues(pts.map((p) => p.x), tol), tol);
  const rows = uniformAxis(clusterValues(pts.map((p) => p.y), tol), tol);
  if (!cols || !rows || cols.count * rows.count !== pts.length) return null;
  const seen = new Set<string>();
  for (const p of pts) {
    const i = Math.round((p.x - cols.first) / (cols.pitch || 1));
    const j = Math.round((p.y - rows.first) / (rows.pitch || 1));
    if (Math.abs(p.x - (cols.first + i * cols.pitch)) > tol || Math.abs(p.y - (rows.first + j * rows.pitch)) > tol) return null;
    if (seen.has(`${i},${j}`)) return null;
    seen.add(`${i},${j}`);
  }
  return { cols, rows };
}

/** Two neighboring hole centers along a direction (for figures), or null. */
export function adjacentHoles(p: HolePatternSet, which: 0 | 1): [Vec3, Vec3] | null {
  const d = p.directions?.[which];
  if (!d || d.count < 2) return null;
  const e = toV(d.dir);
  const at = (c: Vec3) => dot(toV(c), e);
  const sorted = [...p.centers].sort((a, b) => at(a) - at(b));
  const first = d.datum === "min" ? sorted[0] : sorted[sorted.length - 1];
  const next = p.centers
    .filter((c) => Math.abs(Math.abs(at(c) - at(first)) - d.pitch) < PATTERN_TOL_IN * 2)
    .sort((a, b) => Math.hypot(a.x - first.x, a.y - first.y, a.z - first.z) - Math.hypot(b.x - first.x, b.y - first.y, b.z - first.z))[0];
  return next ? [first, next] : null;
}

/** Datum edge point → nearest hole center along a direction (for figures). */
export function edgeSpan(p: HolePatternSet, which: 0 | 1): { edge: Vec3; hole: Vec3 } | null {
  const d = p.directions?.[which];
  if (!d) return null;
  const e = toV(d.dir);
  const sorted = [...p.centers].sort((a, b) => dot(toV(a), e) - dot(toV(b), e));
  const hole = d.datum === "min" ? sorted[0] : sorted[sorted.length - 1];
  const shift = d.datumAt - dot(toV(hole), e);
  return { edge: vec([hole.x + e[0] * shift, hole.y + e[1] * shift, hole.z + e[2] * shift]), hole };
}
