import type { NormalizedEntity, Loop, Point } from "@/types/geometry";
import type { AnalyzedHole, HoleGroup, HoleMatch } from "@/types/analysis";
import { HOLE_MATCH_TOLERANCE_IN, HOLE_STANDARDS } from "./machining-standards";
import { loopAsCircle } from "./loop-builder";
import { dist } from "./geometry";

/** Match a diameter (inches) against the team's standard hole table. */
export function classifyDiameter(diameter: number): HoleMatch[] {
  return HOLE_STANDARDS.filter(
    (s) => Math.abs(diameter - s.diameter) <= HOLE_MATCH_TOLERANCE_IN,
  )
    .map((s) => ({
      label: s.label,
      kind: s.kind,
      nominalDiameter: s.diameter,
      deviation: diameter - s.diameter,
      drill: s.drill,
      note: s.note,
    }))
    .sort((a, b) => Math.abs(a.deviation) - Math.abs(b.deviation));
}

/**
 * Find every hole: CIRCLE entities plus closed loops that resolve to a circle
 * (e.g. a bore drawn as two arcs). Inputs must already be in inches.
 */
export function findHoles(entities: NormalizedEntity[], loops: Loop[]): AnalyzedHole[] {
  const holes: AnalyzedHole[] = [];
  const seen: { center: Point; r: number }[] = [];

  const add = (center: Point, radius: number) => {
    const dup = seen.some((s) => dist(s.center, center) < 1e-3 && Math.abs(s.r - radius) < 1e-3);
    if (dup) return;
    seen.push({ center, r: radius });
    const diameter = radius * 2;
    holes.push({ center, diameter, matches: classifyDiameter(diameter) });
  };

  for (const e of entities) {
    if (e.kind === "circle") add(e.center, e.radius);
  }
  for (const loop of loops) {
    const c = loopAsCircle(loop);
    if (c) add(c.center, c.radius);
  }

  return holes.sort((a, b) => a.diameter - b.diameter);
}

/** Group identical diameters for the summary table. */
export function groupHoles(holes: AnalyzedHole[]): HoleGroup[] {
  const groups = new Map<string, HoleGroup>();
  for (const h of holes) {
    const key = h.diameter.toFixed(4);
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { diameter: h.diameter, count: 1, matches: h.matches });
  }
  return [...groups.values()].sort((a, b) => a.diameter - b.diameter);
}
