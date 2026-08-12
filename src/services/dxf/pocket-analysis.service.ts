import type { Loop, Point, Segment } from "@/types/geometry";
import type { PocketAnalysis } from "@/types/analysis";
import { endTangent, normalizeAngle, startTangent } from "./geometry";
import { loopAsCircle } from "./loop-builder";

const SHARP_ANGLE_TOL = (2 * Math.PI) / 180; // corners within 2° of straight aren't corners

/**
 * Work out endmill constraints for each machinable region.
 *
 * The largest loop is the part's outer profile (tool cuts outside it);
 * every other loop is an internal cutout/pocket (tool cuts inside it).
 * A corner or fillet that is concave *from the tool's side* limits tool radius:
 *   max endmill diameter = 2 × smallest concave fillet radius.
 * Sharp concave corners (radius 0) can't be milled exactly and are flagged.
 */
export function analyzePockets(loops: Loop[]): PocketAnalysis[] {
  if (loops.length === 0) return [];
  const sorted = [...loops].map((loop, i) => ({ loop, i }));
  sorted.sort((a, b) => Math.abs(b.loop.area) - Math.abs(a.loop.area));
  const outerIndex = sorted[0].i;

  return loops
    .map((loop, i) => analyzeLoop(loop, i, i === outerIndex))
    .filter((p): p is PocketAnalysis => p !== null);
}

function analyzeLoop(loop: Loop, index: number, isOuter: boolean): PocketAnalysis | null {
  // full circles are holes, not pockets — the hole analyzer owns those
  if (!isOuter && loopAsCircle(loop)) return null;
  if (loop.segments.length === 0) return null;

  // normalize traversal to CCW so "left turn" always means the same thing
  const segments = loop.area >= 0 ? loop.segments : reverseLoop(loop.segments);

  // For a CCW loop the enclosed region is on the left.
  // Tool region: inside for cutouts, outside for the outer profile.
  // Concave-from-tool features are left turns for cutouts, right turns for the profile.
  const concaveSign = isOuter ? -1 : 1;

  let minFillet: number | null = null;
  const sharpCorners: Point[] = [];

  // fillet arcs: arc curving toward the tool region constrains tool radius
  for (const s of segments) {
    if (s.kind !== "arc") continue;
    const curves = s.ccw ? 1 : -1;
    if (curves === concaveSign) {
      minFillet = minFillet === null ? s.radius : Math.min(minFillet, s.radius);
    }
  }

  // sharp corners: turn direction between consecutive segments
  const n = segments.length;
  for (let i = 0; i < n; i++) {
    const turn = normalizeAngle(startTangent(segments[(i + 1) % n]) - endTangent(segments[i]));
    if (Math.abs(turn) < SHARP_ANGLE_TOL) continue;
    if (Math.sign(turn) === concaveSign) sharpCorners.push(segments[i].b);
  }

  const hasConstraint = minFillet !== null || sharpCorners.length > 0;
  if (isOuter && !hasConstraint) return null; // convex profile: nothing to report

  return {
    loopIndex: index,
    kind: isOuter ? "outer-profile" : "pocket",
    minFilletRadius: minFillet,
    maxEndmillDiameter: minFillet !== null ? minFillet * 2 : null,
    sharpCorners,
  };
}

function reverseLoop(segments: Segment[]): Segment[] {
  return segments
    .slice()
    .reverse()
    .map((s): Segment =>
      s.kind === "line"
        ? { kind: "line", a: s.b, b: s.a }
        : { ...s, a: s.b, b: s.a, ccw: !s.ccw },
    );
}

/** Overall largest endmill that can cut every constrained corner in the part. */
export function overallMaxEndmill(pockets: PocketAnalysis[]): {
  maxEndmillDiameter: number | null;
  sharpCornerCount: number;
} {
  let min: number | null = null;
  let sharp = 0;
  for (const p of pockets) {
    sharp += p.sharpCorners.length;
    if (p.maxEndmillDiameter !== null) {
      min = min === null ? p.maxEndmillDiameter : Math.min(min, p.maxEndmillDiameter);
    }
  }
  return { maxEndmillDiameter: min, sharpCornerCount: sharp };
}

/** Point for placing a warning marker — reuse sharp corner locations. */
export function pocketMarkerPoints(p: PocketAnalysis): Point[] {
  return p.sharpCorners;
}
