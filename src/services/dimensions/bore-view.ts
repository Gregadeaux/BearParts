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
