import type { NormalizedEntity } from "@/types/geometry";
import type { Units } from "@/types/analysis";
import { HOLE_MATCH_TOLERANCE_IN, HOLE_STANDARDS } from "./machining-standards";
import { emptyBBox, expandBBox, finalizeBBox } from "./geometry";
import { entityPoints } from "./render.service";

export interface UnitDetection {
  units: Units;
  scaleToInch: number;
  source: "header" | "heuristic" | "assumed";
}

const MM_PER_INCH = 25.4;

/**
 * Decide what units a DXF is in.
 * Header wins; otherwise score both interpretations by how many circles land on
 * standard hole sizes and whether the part is a plausible physical size.
 */
export function detectUnits(
  entities: NormalizedEntity[],
  headerUnits: Units,
): UnitDetection {
  if (headerUnits === "in") return { units: "in", scaleToInch: 1, source: "header" };
  if (headerUnits === "mm") {
    return { units: "mm", scaleToInch: 1 / MM_PER_INCH, source: "header" };
  }

  const inchScore = scoreInterpretation(entities, 1);
  const mmScore = scoreInterpretation(entities, 1 / MM_PER_INCH);

  if (mmScore > inchScore) {
    return { units: "mm", scaleToInch: 1 / MM_PER_INCH, source: "heuristic" };
  }
  if (inchScore > mmScore) return { units: "in", scaleToInch: 1, source: "heuristic" };
  return { units: "unknown", scaleToInch: 1, source: "assumed" };
}

function scoreInterpretation(entities: NormalizedEntity[], scale: number): number {
  let score = 0;

  // do circle diameters land on standard holes?
  for (const e of entities) {
    if (e.kind !== "circle") continue;
    const d = e.radius * 2 * scale;
    if (HOLE_STANDARDS.some((s) => Math.abs(d - s.diameter) <= HOLE_MATCH_TOLERANCE_IN)) {
      score += 3;
    }
  }

  // is the overall part a sane size for a machined robot part?
  const box = emptyBBox();
  for (const e of entities) for (const p of entityPoints(e)) expandBBox(box, p);
  const { width, height } = finalizeBBox(box);
  const span = Math.max(width, height) * scale;
  if (span >= 0.25 && span <= 60) score += 2;
  if (span > 120) score -= 4;

  return score;
}
