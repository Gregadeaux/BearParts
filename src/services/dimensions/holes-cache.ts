/**
 * The STEP hole summary cached inside `parts.model_size_in` (no column of its
 * own): hole groups (physical holes per face) and the ranked pattern checks.
 * Validation here doubles as the server-side check for the cache action.
 */

import type { PatternCheck, V3 } from "./pattern-dims";

export type Vec3 = V3;

/** One cached hole group: diameter, physical-hole count, axis, member centers. */
export interface CachedHoleGroup {
  /** diameter, inches (thou) */
  d: number;
  /** physical holes (a hole through both walls of a tube counts once) */
  n: number;
  /** unit axis, canonical sign */
  axis: Vec3;
  /** member centers on the face they open into, relative to the bbox center */
  c: Vec3[];
}

export interface CachedHoles {
  groups: CachedHoleGroup[];
  /** distinct groups recognized (≥ groups.length when the cache was trimmed) */
  found: number;
  /** ranked, deduped pitch / hole-to-edge checks (pattern-dims.ts) */
  patterns: PatternCheck[];
  /** checks found (≥ patterns.length when trimmed) */
  patternsFound: number;
}

/**
 * Bump when recognition, counting, or the trims change: rows with another
 * version (or none — box-only rows) re-derive once and upgrade themselves.
 * v3: physical-hole counts (tube walls merged) + pattern checks.
 */
export const HOLES_CACHE_VERSION = 3;
/** cache trims keep the jsonb row small (≲ 25 KB worst case) */
export const MAX_CACHED_GROUPS = 6;
export const MAX_CACHED_CENTERS = 160;
export const MAX_CACHED_PATTERNS = 8;

/** Every k-th member so a trimmed highlight stays spread over the pattern. */
export function spreadSample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  return Array.from({ length: max }, (_, i) => items[Math.floor(i * step)]);
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isVec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(finite);
const thou = (v: number) => Math.round(v * 1000) / 1000;

function asGroup(g: unknown): CachedHoleGroup | null {
  const r = (g ?? {}) as Record<string, unknown>;
  if (!(finite(r.d) && r.d > 0 && finite(r.n) && r.n >= 1 && isVec3(r.axis) && Array.isArray(r.c) && r.c.every(isVec3))) {
    return null;
  }
  return { d: thou(r.d), n: Math.round(r.n), axis: r.axis, c: spreadSample(r.c as Vec3[], MAX_CACHED_CENTERS) };
}

function asPattern(p: unknown): PatternCheck | null {
  const r = (p ?? {}) as Record<string, unknown>;
  const ok =
    (r.k === "s" || r.k === "e") &&
    (r.w === 0 || r.w === 1) &&
    finite(r.v) && r.v > 0 && finite(r.d) && r.d > 0 &&
    isVec3(r.axis) && isVec3(r.a) && isVec3(r.b);
  return ok ? { k: r.k, w: r.w, v: r.v, d: r.d, axis: r.axis, a: r.a, b: r.b } as PatternCheck : null;
}

const count = (v: unknown, atLeast: number) => (finite(v) && v >= atLeast ? Math.round(v) : atLeast);

/**
 * Read the holes part of a cached `model_size_in`. null = not computed yet
 * (box-only rows, or another `holesV`). Drops anything malformed and
 * re-applies the trims.
 */
export function asCachedHoles(value: unknown): CachedHoles | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (!Array.isArray(r.holes) || r.holesV !== HOLES_CACHE_VERSION) return null;
  const groups = r.holes.map(asGroup).filter((g): g is CachedHoleGroup => g !== null).slice(0, MAX_CACHED_GROUPS);
  const patterns = (Array.isArray(r.patterns) ? r.patterns : [])
    .map(asPattern)
    .filter((p): p is PatternCheck => p !== null)
    .slice(0, MAX_CACHED_PATTERNS);
  return {
    groups,
    found: count(r.holesFound, groups.length),
    patterns,
    patternsFound: count(r.patternsFound, patterns.length),
  };
}
