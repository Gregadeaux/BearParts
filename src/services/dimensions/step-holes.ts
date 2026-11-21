/**
 * Hole key dimensions for STEP parts: hole sizes (physical holes per face —
 * a hole through both walls of a tube counts once) and the pattern checks
 * (pitch, hole-to-edge), from B-rep feature recognition + the shared
 * hole-patterns.ts. Derived once per part and cached (holes-cache.ts). Pure;
 * inches, centers relative to the model's bbox center (the 3D figure's frame).
 */

import { classifyDiameter } from "@/services/dxf/hole-analysis.service";
import { recognizeModelFeatures, type ModelFeatures } from "./model-features";
import { modelHolePatterns, type HolePatternSet } from "./hole-patterns";
import { patternChecks, patternKeyDimensions } from "./pattern-dims";
import { HOLE_TOLERANCE_IN, matchNote, type KeyDimension } from "./key-dimensions";
import {
  MAX_CACHED_CENTERS,
  MAX_CACHED_GROUPS,
  MAX_CACHED_PATTERNS,
  spreadSample,
  type CachedHoleGroup,
  type CachedHoles,
  type Vec3,
} from "./holes-cache";

export {
  asCachedHoles,
  HOLES_CACHE_VERSION,
  MAX_CACHED_CENTERS,
  spreadSample,
  type CachedHoleGroup,
  type CachedHoles,
  type Vec3,
} from "./holes-cache";

/** Verify asks about at most this many hole sizes (by count × size). */
export const MAX_HOLE_STEPS = 4;

const thou = (v: number) => Math.round(v * 1000) / 1000;
/** 4 decimals; `+ 0` turns -0 into 0 so cached JSON round-trips exactly */
const r4 = (v: number) => Math.round(v * 10000) / 10000 + 0;

/** "z" / "x" for axis-aligned holes, rounded components otherwise. */
export function axisKey(a: Vec3): string {
  const i = a.findIndex((v) => Math.abs(v) > 0.999);
  if (i >= 0) return "xyz"[i];
  return a.map((v) => v.toFixed(2)).join(",");
}

/** More holes and bigger holes matter more; ties go to the bigger hole. */
const score = (g: CachedHoleGroup) => g.n * g.d;
const byImportance = (a: CachedHoleGroup, b: CachedHoleGroup) => score(b) - score(a) || b.d - a.d;

/**
 * Hole pattern sets (one per face side) → hole groups, merged at the thou per
 * axis direction, most important first. Counts are physical holes.
 */
export function holeGroupsFromSets(sets: HolePatternSet[], center: Vec3): { groups: CachedHoleGroup[]; found: number } {
  const merged = new Map<string, CachedHoleGroup>();
  for (const s of sets) {
    const axis: Vec3 = [r4(s.axis.x), r4(s.axis.y), r4(s.axis.z)];
    const d = thou(s.diameter);
    if (!(d > 0)) continue;
    const key = `${d.toFixed(3)}-${axisKey(axis)}`;
    const centers = s.centers.map((c): Vec3 => [r4(c.x - center[0]), r4(c.y - center[1]), r4(c.z - center[2])]);
    const existing = merged.get(key);
    if (existing) {
      existing.n += s.count;
      existing.c.push(...centers);
    } else {
      merged.set(key, { d, n: s.count, axis, c: centers });
    }
  }
  const all = [...merged.values()].sort(byImportance);
  return {
    groups: all.slice(0, MAX_CACHED_GROUPS).map((g) => ({ ...g, c: spreadSample(g.c, MAX_CACHED_CENTERS) })),
    found: all.length,
  };
}

const boundsCenter = (f: ModelFeatures): Vec3 => [
  (f.bounds.min.x + f.bounds.max.x) / 2,
  (f.bounds.min.y + f.bounds.max.y) / 2,
  (f.bounds.min.z + f.bounds.max.z) / 2,
];

/** Recognized features (inches) → everything Verify caches about holes. */
export function holesFromFeatures(f: ModelFeatures): CachedHoles {
  const sets = modelHolePatterns(f);
  const center = boundsCenter(f);
  const { groups, found } = holeGroupsFromSets(sets, center);
  const checks = patternChecks(sets, center);
  return { groups, found, patterns: checks.slice(0, MAX_CACHED_PATTERNS), patternsFound: checks.length };
}

/**
 * Raw STEP mesh (occt units + B-rep face ids) → cached hole summary. Never
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
    return holesFromFeatures(recognizeModelFeatures(inches, faceIds));
  } catch {
    return { groups: [], found: 0, patterns: [], patternsFound: 0 };
  }
}

/**
 * Cached summary → hole key dimensions: the MAX_HOLE_STEPS most important
 * sizes (shop-table match as the note — shown only at the reveal), then the
 * capped pattern checks. `omitted` = hole checks left out of this check.
 */
export function keyDimensionsFromHoles(
  holes: CachedHoles,
  cap = MAX_HOLE_STEPS,
): { dims: KeyDimension[]; omitted: number } {
  const chosen = [...holes.groups].sort(byImportance).slice(0, cap);
  const sizes = chosen.map((g): KeyDimension => {
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
  const patterns = patternKeyDimensions(holes.patterns);
  const omitted =
    Math.max(0, holes.found - chosen.length) + patterns.omitted + Math.max(0, holes.patternsFound - holes.patterns.length);
  return { dims: [...sizes, ...patterns.dims], omitted };
}
