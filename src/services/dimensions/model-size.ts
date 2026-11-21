/**
 * Overall bounding-box size of a STEP/STL model, in inches.
 *
 * Units (the 3D viewers never convert — they render raw coordinates and size
 * the camera to fit, so these rules live here):
 *  - STEP: occt-import-js tessellates into MILLIMETERS by default
 *    (`linearUnit` param, unset in step-parser.ts) whatever unit the file was
 *    authored in — STEP files declare their unit and OpenCascade converts.
 *  - STL: unitless. Slicers read STL as mm, so a file that prints right is mm.
 *    We assume mm unless the part's `units` column explicitly says "in".
 * The mesh comes from the page's 3D viewer (one parse per page view); the
 * converted box — plus, for STEP, the recognized hole groups — is cached in
 * `parts.model_size_in`.
 */

import {
  asCachedHoles,
  HOLES_CACHE_VERSION,
  type CachedHoleGroup,
  type CachedHoles,
} from "./holes-cache";
import type { PatternCheck } from "./pattern-dims";

export interface ModelSize {
  x: number;
  y: number;
  z: number;
}

export const MM_PER_IN = 25.4;

/** Multiplier from raw model coordinates to inches. */
export function modelScaleToInches(fileType: "step" | "stl", units?: string | null): number {
  if (fileType === "stl" && units === "in") return 1;
  return 1 / MM_PER_IN;
}

export function toInchesSize(
  raw: ModelSize,
  fileType: "step" | "stl",
  units?: string | null,
): ModelSize {
  const k = modelScaleToInches(fileType, units);
  const r = (v: number) => Math.round(v * k * 10000) / 10000;
  return { x: r(raw.x), y: r(raw.y), z: r(raw.z) };
}

/** Validate a cached `parts.model_size_in` jsonb value (the box part). */
export function asModelSize(value: unknown): ModelSize | null {
  if (!value || typeof value !== "object") return null;
  const { x, y, z } = value as Record<string, unknown>;
  const ok = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  return ok(x) && ok(y) && ok(z) ? { x: x as number, y: y as number, z: z as number } : null;
}

/**
 * The whole cached row: box + (STEP only) recognized hole groups and pattern
 * checks. A row without the current `holesV` is treated as "not yet".
 */
export interface ModelSizeCache extends ModelSize {
  holes?: CachedHoleGroup[];
  holesFound?: number;
  patterns?: PatternCheck[];
  patternsFound?: number;
  /** HOLES_CACHE_VERSION the holes were derived with */
  holesV?: number;
}

/** The cache row for a box and (STEP) its derived holes. */
export function modelSizeCache(size: ModelSize, holes?: CachedHoles | null): ModelSizeCache {
  const box = { x: size.x, y: size.y, z: size.z };
  if (!holes) return box;
  return {
    ...box,
    holes: holes.groups,
    holesFound: holes.found,
    patterns: holes.patterns,
    patternsFound: holes.patternsFound,
    holesV: HOLES_CACHE_VERSION,
  };
}

/** Validate + trim a cache payload (server action input or a stored row). */
export function asModelSizeCache(value: unknown): ModelSizeCache | null {
  const size = asModelSize(value);
  return size ? modelSizeCache(size, asCachedHoles(value)) : null;
}
