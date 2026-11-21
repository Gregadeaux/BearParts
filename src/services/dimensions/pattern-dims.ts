/**
 * Hole-pattern verification checks — the pitch and hole-to-edge distances the
 * drawing dimensions, from the shared hole-patterns.ts (so the two can't
 * disagree). Pure; inches. `PatternCheck` is plain numbers so STEP parts can
 * cache it inside `parts.model_size_in`.
 */

import type { DxfAnalysis } from "@/types/analysis";
import type { KeyDimension } from "./key-dimensions";
import { adjacentHoles, dxfHolePatterns, edgeSpan, type HolePatternSet } from "./hole-patterns";
import { DEFAULT_TOLERANCE_IN } from "./tolerances";

export type V3 = [number, number, number];

export interface PatternCheck {
  /** "s" = hole spacing (center-to-center pitch), "e" = datum edge → nearest hole center */
  k: "s" | "e";
  /** 0 = along the face's longer extent (length / the end), 1 = across it (the side) */
  w: 0 | 1;
  /** the distance, inches (exact 64ths snapped: tube stock's .4375 stays .4375) */
  v: number;
  /** hole diameter — figure ring size */
  d: number;
  /** hole axis — the 3D figure looks down it */
  axis: V3;
  /** spacing: two adjacent hole centers; edge: the datum-edge point, then the hole center */
  a: V3;
  b: V3;
}

/** At most this many pattern checks per part (on top of the hole-size cap). */
export const MAX_PATTERN_STEPS = 4;

const LABELS: Record<string, string> = {
  s0: "Hole spacing — along length",
  s1: "Hole spacing — across",
  e0: "Hole to end",
  e1: "Hole to side edge",
};

/** within a pattern: pitch along the length, hole to end, hole to side edge, pitch across */
const ORDER: [PatternCheck["k"], 0 | 1][] = [["s", 0], ["e", 0], ["e", 1], ["s", 1]];

const thou = (v: number) => Math.round(v * 1000) / 1000;
/** 4 decimals; `+ 0` turns -0 into 0 so cached JSON round-trips exactly */
const r4 = (v: number) => Math.round(v * 10000) / 10000 + 0;

/** Exact 64ths (tube hole grids: 7/16) survive mesh noise before thou rounding. */
export function snap64(v: number): number {
  const n = Math.round(v * 64);
  return Math.abs(v * 64 - n) < 0.002 ? n / 64 : v;
}

/** "7/16" for an exact 64th that doesn't read exactly at three decimals; else undefined. */
export function fractionNote(v: number): string | undefined {
  const n = Math.round(v * 64);
  if (n <= 0 || Math.abs(v * 64 - n) > 1e-6 || Math.abs(thou(v) - v) < 1e-9) return undefined;
  let [num, den] = [n, 64];
  while (num % 2 === 0) [num, den] = [num / 2, den / 2];
  const whole = Math.floor(num / den);
  return whole > 0 ? `${whole}-${num % den}/${den}` : `${num}/${den}`;
}

/**
 * Every measurable pitch / hole-to-edge distance of a part, most important
 * pattern first (count × size), in ORDER within each. Irregular sets are
 * skipped. The same pitch anywhere, or the same edge role + distance on
 * another face/pattern, is asked once.
 *
 * @param offset subtracted from every point (3D: the model's bbox center)
 */
export function patternChecks(sets: HolePatternSet[], offset: V3 = [0, 0, 0]): PatternCheck[] {
  const pt = (p: { x: number; y: number; z: number }): V3 =>
    [r4(p.x - offset[0]), r4(p.y - offset[1]), r4(p.z - offset[2])];
  const ranked = sets
    .filter((s) => s.directions && s.kind !== "irregular")
    .sort((a, b) => b.count * b.diameter - a.count * a.diameter || b.diameter - a.diameter);
  const seen = new Set<string>();
  const out: PatternCheck[] = [];
  for (const s of ranked) {
    for (const [k, w] of ORDER) {
      const dir = s.directions![w];
      const raw = k === "s" ? (dir.count >= 2 ? dir.pitch : 0) : dir.edgeDistance;
      if (!(raw > 0.001)) continue;
      const ends = k === "s" ? adjacentHoles(s, w) : edgeSpan(s, w);
      if (!ends) continue;
      const v = r4(snap64(raw));
      const key = k === "s" ? `s|${thou(v)}` : `e|${w}|${thou(v)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const [a, b] = Array.isArray(ends) ? ends : [ends.edge, ends.hole];
      out.push({ k, w, v, d: thou(s.diameter), axis: [r4(s.axis.x), r4(s.axis.y), r4(s.axis.z)], a: pt(a), b: pt(b) });
    }
  }
  return out;
}

/**
 * DXF hole-pattern checks (pitch, hole-to-edge), ranked and capped; the same
 * patterns the drawing dimensions. `omitted` = checks left out by the cap.
 */
export function dxfPatternDimensions(analysis: DxfAnalysis): { dims: KeyDimension[]; omitted: number } {
  if (!analysis.holes?.length) return { dims: [], omitted: 0 };
  try {
    return patternKeyDimensions(patternChecks(dxfHolePatterns(analysis)));
  } catch {
    return { dims: [], omitted: 0 }; // pattern trouble never blocks a check
  }
}

/** Checks → key dimensions, capped. `omitted` = checks left out of this verification. */
export function patternKeyDimensions(
  checks: PatternCheck[],
  cap = MAX_PATTERN_STEPS,
): { dims: KeyDimension[]; omitted: number } {
  const chosen = checks.slice(0, cap);
  const dims = chosen.map((c): KeyDimension => {
    const note = fractionNote(c.v);
    return {
      id: `${c.k === "s" ? "pitch" : "edge"}-${c.w}-${thou(c.v).toFixed(3)}`,
      kind: c.k === "s" ? "hole_spacing" : "edge_distance",
      label: LABELS[`${c.k}${c.w}`],
      nominal: thou(c.v),
      tolerance: DEFAULT_TOLERANCE_IN,
      ...(note ? { note } : {}),
      feature: { type: "span", ends: c.k === "s" ? "holes" : "edge", a: c.a, b: c.b, axis: c.axis, diameter: c.d },
    };
  });
  return { dims, omitted: checks.length - chosen.length };
}
