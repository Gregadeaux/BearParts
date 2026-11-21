/** 3D hole steps: look straight down the hole axis so the group reads as circles. Pure. */

import type { Vec3 } from "./figure-3d";

export interface BoreView {
  /** from the model toward the camera: straight down the hole axis */
  cameraDir: Vec3;
  /** screen up */
  upVec: Vec3;
  /** screen right (with upVec, spans the plane the holes are seen in) */
  rightVec: Vec3;
  /** projected size of the box on screen, model units */
  width: number;
  height: number;
}

const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm3 = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** share of the figure a focused span fills on screen */
const FOCUS_FRACTION = 0.45;

/**
 * Down-axis framing for a short span a→b (adjacent holes, or edge → hole):
 * it fills ~45% of the figure, centered, at least `minSpan` units across —
 * never zoomed out past the whole-part `fitZoom` (then the target is the
 * model center).
 */
export function spanFraming(
  view: BoreView,
  a: Vec3,
  b: Vec3,
  px: { width: number; height: number },
  minSpan: number,
  fitZoom: number,
): { zoom: number; target: Vec3 } {
  const d = sub3(b, a);
  const sx = Math.max(Math.abs(dot3(d, view.rightVec)), minSpan * FOCUS_FRACTION);
  const sy = Math.abs(dot3(d, view.upVec));
  const zoom = Math.min((px.width * FOCUS_FRACTION) / sx, sy > 1e-9 ? (px.height * FOCUS_FRACTION) / sy : Infinity);
  if (!(zoom > fitZoom)) return { zoom: fitZoom, target: [0, 0, 0] };
  return { zoom, target: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] };
}

/**
 * The datum edge in the down-axis view: a segment through the edge point,
 * perpendicular to edge→hole within the face, spanning the (centered) box.
 */
export function edgeLine3D(a: Vec3, b: Vec3, axis: Vec3, size: { x: number; y: number; z: number }): [Vec3, Vec3] {
  const u = norm3(sub3(b, a));
  const p = norm3(cross3(axis, u));
  const corners: Vec3[] = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [
    (i & 1 ? 0.5 : -0.5) * size.x,
    (i & 2 ? 0.5 : -0.5) * size.y,
    (i & 4 ? 0.5 : -0.5) * size.z,
  ]);
  const ts = corners.map((c) => dot3(sub3(c, a), p));
  const [lo, hi] = [Math.min(...ts), Math.max(...ts)];
  const at = (t: number): Vec3 => [a[0] + p[0] * t, a[1] + p[1] * t, a[2] + p[2] * t];
  return [at(lo), at(hi)];
}

/**
 * Look straight down a hole axis (any direction) at an axis-aligned box. The
 * longer projected side of the part goes horizontal (the figure is wide), +
 * to the right so engraved text isn't upside down.
 */
export function boreView(size: { x: number; y: number; z: number }, axis: Vec3): BoreView {
  const a = norm3(axis);
  // seed with the principal axis least aligned with the hole axis
  const i = [0, 1, 2].reduce((m, k) => (Math.abs(a[k]) < Math.abs(a[m]) ? k : m), 0);
  const seed: Vec3 = [0, 0, 0];
  seed[i] = 1;
  const u = norm3(cross3(a, seed));
  const w = cross3(a, u);
  const extent = (v: Vec3) => Math.abs(v[0]) * size.x + Math.abs(v[1]) * size.y + Math.abs(v[2]) * size.z;
  const longer = extent(u) >= extent(w) ? u : w;
  const dom = [0, 1, 2].reduce((m, k) => (Math.abs(longer[k]) > Math.abs(longer[m]) ? k : m), 0);
  const right = longer[dom] < 0 ? (longer.map((v) => -v) as Vec3) : longer;
  // right-handed screen: up = axis × right, so right × up points at the camera
  const upVec = cross3(a, right);
  return { cameraDir: a, upVec, rightVec: right, width: extent(right), height: extent(upVec) };
}
