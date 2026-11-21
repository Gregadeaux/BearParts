import type { ModelFeatures, Vec3 } from "@/services/dimensions/model-features";
import type { LineView, V3, ViewBasis } from "./hlr";
import { pt, type Pt } from "./primitives";
import type { Box } from "./text-metrics";

export type ViewKey = "front" | "top" | "right" | "iso";

/** A view drawn on the sheet: its lower-left at (box.x0, box.y0). */
export interface PlacedView {
  key: ViewKey;
  basis: ViewBasis;
  view: LineView;
  box: Box;
  scale: number;
}

/** Model point (inches) → sheet point. */
export function project(pv: PlacedView, p: V3): Pt {
  const { right, up } = pv.basis;
  const u = p[0] * right[0] + p[1] * right[1] + p[2] * right[2];
  const v = p[0] * up[0] + p[1] * up[1] + p[2] * up[2];
  return pt(pv.box.x0 + (u - pv.view.minU) * pv.scale, pv.box.y0 + (v - pv.view.minV) * pv.scale);
}

/** The view's visible edges as sheet-space 2-point polylines. */
export function viewPolys(pv: PlacedView): Pt[][] {
  const { segs, minU, minV } = pv.view;
  const out: Pt[][] = [];
  for (let i = 0; i < segs.length; i += 4) {
    out.push([
      pt(pv.box.x0 + (segs[i] - minU) * pv.scale, pv.box.y0 + (segs[i + 1] - minV) * pv.scale),
      pt(pv.box.x0 + (segs[i + 2] - minU) * pv.scale, pv.box.y0 + (segs[i + 3] - minV) * pv.scale),
    ]);
  }
  return out;
}

export const v3 = (p: Vec3): V3 => [p.x, p.y, p.z];

/**
 * Drawing orientation: a turned part's axis becomes model X (horizontal in
 * FRONT, a circle in RIGHT); otherwise the axis shared by most holes becomes
 * Z (circles in TOP, like a plate). Returns a proper rotation (rows = new
 * x, y, z axes) or null to keep the model as authored.
 */
export function drawingFrame(f: ModelFeatures): [V3, V3, V3] | null {
  let target: { axis: V3; to: "x" | "z" } | null = null;
  if (f.turned) target = { axis: v3(f.turned.axis), to: "x" };
  else {
    const byAxis = new Map<string, { axis: V3; n: number }>();
    for (const h of f.holes) {
      const a = v3(h.axis);
      const key = a.map((c) => c.toFixed(3)).join();
      const e = byAxis.get(key) ?? { axis: a, n: 0 };
      e.n += h.count;
      byAxis.set(key, e);
    }
    const best = [...byAxis.values()].sort((a, b) => b.n - a.n)[0];
    if (best) target = { axis: best.axis, to: "z" };
  }
  if (!target) return null;
  const a = target.axis;
  if (target.to === "x") {
    if (Math.abs(a[0]) > 0.9999) return null;
    const ref: V3 = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
    const z = norm(sub(ref, scale(a, dot(ref, a))));
    return [a, cross(z, a), z];
  }
  if (Math.abs(a[2]) > 0.9999) return null;
  const ref: V3 = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const x = norm(sub(ref, scale(a, dot(ref, a))));
  return [x, cross(a, x), a];
}

/** Apply a frame from `drawingFrame` to triangle positions. */
export function rotatePositions(p: ArrayLike<number>, m: [V3, V3, V3]): Float64Array {
  const out = new Float64Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    const q: V3 = [p[i], p[i + 1], p[i + 2]];
    out[i] = dot(m[0], q);
    out[i + 1] = dot(m[1], q);
    out[i + 2] = dot(m[2], q);
  }
  return out;
}

/**
 * Two views that draw the same picture (TOP vs FRONT of a turned part):
 * compare their line rasters on a coarse grid.
 */
export function viewsMatch(a: LineView, b: LineView): boolean {
  const wa = a.maxU - a.minU, ha = a.maxV - a.minV;
  const wb = b.maxU - b.minU, hb = b.maxV - b.minV;
  const span = Math.max(wa, ha, 1e-9);
  if (Math.abs(wa - wb) > span * 0.01 || Math.abs(ha - hb) > span * 0.01) return false;
  const cell = span / 120;
  const raster = (v: LineView) => {
    const s = new Set<number>();
    for (let i = 0; i < v.segs.length; i += 4) {
      const [u0, v0, u1, v1] = [v.segs[i] - v.minU, v.segs[i + 1] - v.minV, v.segs[i + 2] - v.minU, v.segs[i + 3] - v.minV];
      const n = Math.max(1, Math.ceil(Math.hypot(u1 - u0, v1 - v0) / cell) * 2);
      for (let k = 0; k <= n; k++) {
        s.add(Math.floor((u0 + ((u1 - u0) * k) / n) / cell) * 1000 + Math.floor((v0 + ((v1 - v0) * k) / n) / cell));
      }
    }
    return s;
  };
  const ra = raster(a), rb = raster(b);
  // tolerate one-cell jitter
  const near = (s: Set<number>, c: number) => s.has(c) || s.has(c + 1) || s.has(c - 1) || s.has(c + 1000) || s.has(c - 1000);
  let miss = 0;
  for (const c of ra) if (!near(rb, c)) miss++;
  for (const c of rb) if (!near(ra, c)) miss++;
  return miss <= 0.02 * (ra.size + rb.size);
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => scale(a, 1 / (Math.hypot(...a) || 1));
