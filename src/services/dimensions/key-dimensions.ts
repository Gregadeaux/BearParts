/**
 * Key dimensions: the handful of measurements a student checks with calipers
 * to verify a finished part. Derived automatically — never typed by hand —
 * from the DXF analysis (2D parts) or the model bounding box (STEP/STL).
 *
 * Pure and isomorphic (no React / Supabase / Node), like src/services/dxf.
 * Everything is in inches. Shop tolerances: tolerances.ts (re-exported here).
 */

import type { AnalyzedHole, DxfAnalysis, HoleGroup, HoleMatch } from "@/types/analysis";
import type { Point } from "@/types/geometry";
import { DEFAULT_TOLERANCE_IN, HOLE_TOLERANCE_IN } from "./tolerances";
import { dxfPatternDimensions } from "./pattern-dims";

export { DEFAULT_TOLERANCE_IN, HOLE_TOLERANCE_IN };
export { dxfPatternDimensions };

export type KeyDimensionKind =
  | "length"
  | "width"
  | "height"
  | "thickness"
  | "hole_diameter"
  /** center-to-center pitch along a hole pattern direction */
  | "hole_spacing"
  /** datum edge → nearest hole center */
  | "edge_distance";

type V3 = [number, number, number];

/**
 * Where a dimension lives on the part, for the verify figure. Display-only:
 * never persisted with a verification record.
 *  - extent: overall size along a model axis (DXF: x/y of the profile; 3D: x/y/z of the box)
 *  - holes: every hole in the group (DXF coordinates, inches)
 *  - bores: a 3D hole group — shared axis + member centers (inches, relative
 *    to the model's bounding-box center)
 *  - span: a pattern distance — two adjacent hole centers ("holes"), or a
 *    datum-edge point and the nearest hole center ("edge"); DXF coordinates
 *    (z = 0) or 3D relative to the bbox center, viewed down `axis`
 */
export type KeyDimensionFeature =
  | { type: "extent"; axis: "x" | "y" | "z" }
  | { type: "holes"; centers: Point[]; diameter: number }
  | { type: "bores"; axis: V3; centers: V3[]; diameter: number }
  | { type: "span"; ends: "holes" | "edge"; a: V3; b: V3; axis: V3; diameter: number };

export interface KeyDimension {
  /** stable within a part, e.g. "length", "hole-0.201" */
  id: string;
  kind: KeyDimensionKind;
  /** "Overall length", "Hole ⌀" */
  label: string;
  /** inches, rounded to the thou */
  nominal: number;
  /** ± inches */
  tolerance: number;
  /** hole groups: how many holes share this diameter */
  count?: number;
  /** e.g. best hole-match label */
  note?: string;
  /** what to highlight in the figure; absent when there's nothing honest to point at */
  feature?: KeyDimensionFeature;
}

interface Opts {
  thicknessIn?: number | null;
}

type Axis = "x" | "y" | "z";

/** Nominals are shown and judged to the thou — round once so both agree. */
const thou = (v: number) => Math.round(v * 1000) / 1000;
const usable = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

function makeDim(kind: KeyDimensionKind, label: string, nominal: number): KeyDimension {
  return {
    id: kind,
    kind,
    label,
    nominal: thou(nominal),
    tolerance: kind === "hole_diameter" ? HOLE_TOLERANCE_IN : DEFAULT_TOLERANCE_IN,
  };
}

const extent = (axis: Axis): KeyDimensionFeature => ({ type: "extent", axis });

/**
 * Best shop-table match label; ties (0.201" = #10 free fit AND 1/4-20 tap)
 * are all listed. Shared by DXF hole groups and STEP bores.
 */
export function matchNote(matches: HoleMatch[]): string | undefined {
  if (matches.length === 0) return undefined;
  const best = Math.min(...matches.map((m) => Math.abs(m.deviation)));
  return matches
    .filter((m) => Math.abs(m.deviation) - best < 0.0005)
    .map((m) => m.label)
    .join(" / ");
}

const holeNote = (group: HoleGroup) => matchNote(group.matches);

/** Holes whose diameter rounds to `nominal` (thou) — the members of one hole dimension. */
export function holeCentersFor(holes: AnalyzedHole[], nominal: number): Point[] {
  return holes.filter((h) => usable(h.diameter) && thou(h.diameter) === nominal).map((h) => h.center);
}

/** One entry per distinct hole diameter; groups that round to the same thou merge. */
function holeDimensions(groups: HoleGroup[], holes: AnalyzedHole[]): KeyDimension[] {
  const byId = new Map<string, KeyDimension>();
  for (const g of groups) {
    if (!usable(g.diameter)) continue;
    const nominal = thou(g.diameter);
    const id = `hole-${nominal.toFixed(3)}`;
    const existing = byId.get(id);
    if (existing) {
      existing.count = (existing.count ?? 1) + g.count;
      continue;
    }
    const note = holeNote(g);
    const centers = holeCentersFor(holes, nominal);
    byId.set(id, {
      ...makeDim("hole_diameter", "Hole ⌀", g.diameter),
      id,
      count: g.count,
      ...(note ? { note } : {}),
      ...(centers.length > 0 ? { feature: { type: "holes", centers, diameter: nominal } } : {}),
    });
  }
  return [...byId.values()];
}

/**
 * DXF parts: overall length (larger extent), overall width (smaller extent),
 * thickness when known, one entry per hole group, then the most important
 * hole-pattern distances. Square profiles call x the length.
 */
export function keyDimensionsFromAnalysis(analysis: DxfAnalysis, opts?: Opts): KeyDimension[] {
  const out: KeyDimension[] = [];
  const { width, height } = analysis.boundingBox;
  const [lengthAxis, widthAxis]: Axis[] = width >= height ? ["x", "y"] : ["y", "x"];
  const length = Math.max(width, height);
  const across = Math.min(width, height);
  const thickness = opts?.thicknessIn;
  if (usable(length)) out.push({ ...makeDim("length", "Overall length", length), feature: extent(lengthAxis) });
  if (usable(across)) out.push({ ...makeDim("width", "Overall width", across), feature: extent(widthAxis) });
  // a flat profile has no thickness feature to point at — the figure says so instead
  if (usable(thickness)) out.push(makeDim("thickness", "Thickness", thickness));
  out.push(...holeDimensions(analysis.holeGroups, analysis.holes ?? []));
  out.push(...dxfPatternDimensions(analysis).dims);
  return out;
}

/** Box axes, largest extent first (ties keep x, y, z order). */
export function axesBySize(size: { x: number; y: number; z: number }): Axis[] {
  return (["x", "y", "z"] as Axis[]).sort((a, b) => size[b] - size[a]);
}

/**
 * STEP/STL parts: overall length ≥ width ≥ height from the bounding box
 * (inches), each tagged with the model axis it was measured along. A known
 * thickness that matches the height is the same caliper reading, so it
 * replaces "Overall height" (and inherits its axis); otherwise both are
 * listed (e.g. a bent bracket: 1.5" tall, 0.125" stock — no single axis).
 */
export function keyDimensionsFromBox(
  size: { x: number; y: number; z: number },
  opts?: Opts,
): KeyDimension[] {
  const [lengthAxis, widthAxis, heightAxis] = axesBySize(size);
  const [length, width, height] = [size[lengthAxis], size[widthAxis], size[heightAxis]];
  const out: KeyDimension[] = [];
  if (usable(length)) out.push({ ...makeDim("length", "Overall length", length), feature: extent(lengthAxis) });
  if (usable(width)) out.push({ ...makeDim("width", "Overall width", width), feature: extent(widthAxis) });

  const raw = opts?.thicknessIn;
  const thickness = usable(raw) ? raw : null;
  const sameAsHeight =
    thickness !== null &&
    usable(height) &&
    Math.abs(thou(thickness) - thou(height)) <= DEFAULT_TOLERANCE_IN;
  if (usable(height) && !sameAsHeight) {
    out.push({ ...makeDim("height", "Overall height", height), feature: extent(heightAxis) });
  }
  if (thickness !== null) {
    const dim = makeDim("thickness", "Thickness", thickness);
    out.push(sameAsHeight ? { ...dim, feature: extent(heightAxis) } : dim);
  }
  return out;
}

/** Fixed three decimals, no unit: 4.25 → "4.250", 0.201 → "0.201". */
export function formatInches(value: number): string {
  return value.toFixed(3);
}

/**
 * Passes when |measured − nominal| ≤ tolerance. Deviation is measured − nominal,
 * rounded to 0.0001" (caliper resolution) so float noise never flips a result.
 */
export function checkDimension(
  dim: KeyDimension,
  measured: number,
): { pass: boolean; deviation: number } {
  const deviation = Math.round((measured - dim.nominal) * 10000) / 10000;
  return { pass: Math.abs(deviation) <= dim.tolerance + 1e-9, deviation };
}
