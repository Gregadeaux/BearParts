import type { AnalyzedHole, EndmillOption, EndmillPlan, PocketAnalysis } from "@/types/analysis";

/** Standard metric endmill sizes the shop stocks (mm). */
export const METRIC_ENDMILLS_MM = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12];

const MM_PER_INCH = 25.4;
/** interpolating a hole needs the tool a hair under the bore */
const HOLE_CLEARANCE_IN = 0.001;
/** bolt holes bigger than this aren't a thing on our robots */
const BOLT_HOLE_MAX_IN = 0.28;

/** Largest catalog endmill with diameter ≤ limit (inches), or null. */
export function largestEndmillWithin(limitIn: number): EndmillOption | null {
  for (let i = METRIC_ENDMILLS_MM.length - 1; i >= 0; i--) {
    const diameterIn = METRIC_ENDMILLS_MM[i] / MM_PER_INCH;
    if (diameterIn <= limitIn + 1e-9) return { sizeMm: METRIC_ENDMILLS_MM[i], diameterIn };
  }
  return null;
}

/** Bolt holes are milled with the small tool in the two-endmill plan. */
export function isBoltHole(hole: AnalyzedHole): boolean {
  const kind = hole.matches[0]?.kind;
  if (kind === "tap" || kind === "close-fit" || kind === "free-fit") return true;
  return hole.matches.length === 0 && hole.diameter <= BOLT_HOLE_MAX_IN;
}

/**
 * Recommend endmills assuming every hole is interpolated with an endmill
 * (no drill bits): a single do-everything tool, and — when it buys a bigger
 * tool for the bulk of the work — a two-tool option that reserves a small
 * endmill for bolt holes.
 */
export function planEndmills(holes: AnalyzedHole[], pockets: PocketAnalysis[]): EndmillPlan {
  const limits = { bolt: Infinity, rest: Infinity };

  for (const h of holes) {
    const key = isBoltHole(h) ? "bolt" : "rest";
    limits[key] = Math.min(limits[key], h.diameter - HOLE_CLEARANCE_IN);
  }
  for (const p of pockets) {
    if (p.maxEndmillDiameter !== null) {
      limits.rest = Math.min(limits.rest, p.maxEndmillDiameter);
    }
  }

  const hasBolt = isFinite(limits.bolt);
  const hasRest = isFinite(limits.rest);
  if (!hasBolt && !hasRest) return { single: null, split: null };

  const single = largestEndmillWithin(Math.min(limits.bolt, limits.rest));

  let split: EndmillPlan["split"] = null;
  if (hasBolt && hasRest) {
    const boltTool = largestEndmillWithin(limits.bolt);
    const restTool = largestEndmillWithin(limits.rest);
    // only worth carrying two tools if the big one really is bigger
    if (boltTool && restTool && restTool.sizeMm > (single?.sizeMm ?? 0)) {
      split = { boltHoles: boltTool, rest: restTool };
    }
  }

  return { single, split };
}
