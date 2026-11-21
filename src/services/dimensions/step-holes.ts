/**
 * Hole/bore key dimensions for STEP parts, from B-rep feature recognition
 * (model-features.ts). The derived groups are small and cached inside
 * `parts.model_size_in` (as `holes` + `holesFound`) so recognition runs once
 * per part. Pure; all lengths in inches, centers relative to the model's
 * bounding-box center (the same frame the 3D figure draws in).
 */

import { classifyDiameter } from "@/services/dxf/hole-analysis.service";
import { recognizeModelFeatures, type ModelFeatures } from "./model-features";
import { HOLE_TOLERANCE_IN, matchNote, type KeyDimension } from "./key-dimensions";

export type Vec3 = [number, number, number];

/** One cached hole group: diameter, count, axis, member centers. */
export interface CachedHoleGroup {
  /** diameter, inches (thou) */
  d: number;
  /** how many holes */
  n: number;
  /** unit axis, canonical sign */
  axis: Vec3;
  /** member centers (mid-depth on the axis), ≤ MAX_CACHED_CENTERS */
  c: Vec3[];
}

export interface CachedHoles {
  groups: CachedHoleGroup[];
  /** distinct groups recognized (≥ groups.length when the cache was trimmed) */
  found: number;
}

/**
 * Bump when recognition or the trims change: cached rows with another
 * version (or none — box-only rows) re-derive once and upgrade themselves.
 */
export const HOLES_CACHE_VERSION = 2;

/** Verify asks about at most this many hole sizes (by count × size). */
export const MAX_HOLE_STEPS = 4;
/**
 * Cache trims keep the jsonb row small (≲ 25 KB worst case): a few groups
 * beyond the flow cap, and centers evenly subsampled past 160 so a big
 * pattern's highlight still covers the whole part.
 */
export const MAX_CACHED_GROUPS = 6;
export const MAX_CACHED_CENTERS = 160;

/** Every k-th member so a trimmed highlight stays spread over the pattern. */
export function spreadSample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  return Array.from({ length: max }, (_, i) => items[Math.floor(i * step)]);
}

const thou = (v: number) => Math.round(v * 1000) / 1000;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** "z" / "-x" style key for axis-aligned holes, rounded components otherwise. */
export function axisKey(a: Vec3): string {
  const i = a.findIndex((v) => Math.abs(v) > 0.999);
  if (i >= 0) return "xyz"[i];
  return a.map((v) => v.toFixed(2)).join(",");
}

/** More holes and bigger holes matter more; ties go to the bigger hole. */
const score = (g: CachedHoleGroup) => g.n * g.d;
const byImportance = (a: CachedHoleGroup, b: CachedHoleGroup) => score(b) - score(a) || b.d - a.d;

/**
 * Recognized hole patterns (inches) → cache groups, merged at the thou per
 * axis direction, most important first, trimmed for storage.
 */
export function holeGroupsFromFeatures(f: ModelFeatures, center: Vec3): CachedHoles {
  const merged = new Map<string, CachedHoleGroup>();
  for (const h of f.holes) {
    const axis: Vec3 = [h.axis.x, h.axis.y, h.axis.z];
    const d = thou(h.diameter);
    if (!(d > 0)) continue;
    const key = `${d.toFixed(3)}-${axisKey(axis)}`;
    const centers = h.members.map((i): Vec3 => {
      const cyl = f.cylinders[i];
      const mid = (cyl.extent[0] + cyl.extent[1]) / 2;
      return [
        r4(cyl.origin.x + cyl.axis.x * mid - center[0]),
        r4(cyl.origin.y + cyl.axis.y * mid - center[1]),
        r4(cyl.origin.z + cyl.axis.z * mid - center[2]),
      ];
    });
    const existing = merged.get(key);
    if (existing) {
      existing.n += h.count;
      existing.c.push(...centers);
    } else {
      merged.set(key, { d, n: h.count, axis: axis.map(r4) as Vec3, c: centers });
    }
  }
  const all = [...merged.values()].sort(byImportance);
  return {
    groups: all.slice(0, MAX_CACHED_GROUPS).map((g) => ({ ...g, c: spreadSample(g.c, MAX_CACHED_CENTERS) })),
    found: all.length,
  };
}

/** Axis-aligned bbox center of raw triangle positions. */
function bboxCenter(p: ArrayLike<number>, k: number): Vec3 {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i++) {
    const a = i % 3;
    lo[a] = Math.min(lo[a], p[i]);
    hi[a] = Math.max(hi[a], p[i]);
  }
  return [0, 1, 2].map((a) => ((lo[a] + hi[a]) / 2) * k) as Vec3;
}

/**
 * Raw STEP mesh (occt units + B-rep face ids) → cached hole groups. Never
 * throws: recognition trouble means "no holes", and Verify falls back to the
 * box dimensions.
 */
export function deriveStepHoles(
  positions: ArrayLike<number>,
  faceIds: ArrayLike<number>,
  inchesPerUnit: number,
): CachedHoles {
  try {
    const inches = new Float64Array(positions.length);
    for (let i = 0; i < inches.length; i++) inches[i] = positions[i] * inchesPerUnit;
    return holeGroupsFromFeatures(recognizeModelFeatures(inches, faceIds), bboxCenter(positions, inchesPerUnit));
  } catch {
    return { groups: [], found: 0 };
  }
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isVec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(finite);

/**
 * Read the `holes` part of a cached `model_size_in`. null = not computed yet
 * (box-only rows from before hole recognition, or an older `holesV`). Drops
 * anything malformed and re-applies the trims, so it doubles as the
 * server-side validator.
 */
export function asCachedHoles(value: unknown): CachedHoles | null {
  if (!value || typeof value !== "object") return null;
  const { holes, holesFound, holesV } = value as Record<string, unknown>;
  if (!Array.isArray(holes) || holesV !== HOLES_CACHE_VERSION) return null;
  const groups = holes
    .filter((g): g is CachedHoleGroup => {
      const r = (g ?? {}) as Record<string, unknown>;
      return finite(r.d) && r.d > 0 && finite(r.n) && r.n >= 1 && isVec3(r.axis) && Array.isArray(r.c) && r.c.every(isVec3);
    })
    .slice(0, MAX_CACHED_GROUPS)
    .map((g) => ({ d: thou(g.d), n: Math.round(g.n), axis: g.axis, c: spreadSample(g.c, MAX_CACHED_CENTERS) }));
  const found = finite(holesFound) && holesFound >= groups.length ? Math.round(holesFound) : groups.length;
  return { groups, found };
}

/**
 * Cached groups → hole key dimensions: the MAX_HOLE_STEPS most important
 * (count × size), each with its shop-table match as the note (shown only at
 * the reveal). `omitted` = hole sizes left out of the check.
 */
export function keyDimensionsFromHoles(
  holes: CachedHoles,
  cap = MAX_HOLE_STEPS,
): { dims: KeyDimension[]; omitted: number } {
  const chosen = [...holes.groups].sort(byImportance).slice(0, cap);
  const dims = chosen.map((g): KeyDimension => {
    const note = matchNote(classifyDiameter(g.d));
    return {
      id: `hole-${g.d.toFixed(3)}-${axisKey(g.axis)}`,
      kind: "hole_diameter",
      label: "Hole ⌀",
      nominal: g.d,
      tolerance: HOLE_TOLERANCE_IN,
      count: g.n,
      ...(note ? { note } : {}),
      feature: { type: "bores", axis: g.axis, centers: g.c, diameter: g.d },
    };
  });
  return { dims, omitted: Math.max(0, holes.found - chosen.length) };
}
