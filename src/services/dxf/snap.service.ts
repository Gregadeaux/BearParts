import type { NormalizedEntity, Point } from "@/types/geometry";
import type { AnalyzedHole } from "@/types/analysis";
import { dist } from "./geometry";

export interface SnapResult {
  x: number;
  y: number;
  /** human label for the snapped feature, e.g. `⌀0.196" hole` */
  label: string;
}

/**
 * Snap a clicked point to the nearest interesting feature within tolerance:
 * hole centers win, then vertices/endpoints (corners), else the raw point.
 * Everything in inches.
 */
export function snapToFeature(
  entities: NormalizedEntity[],
  holes: AnalyzedHole[],
  point: Point,
  toleranceIn: number,
): SnapResult {
  const hole = nearest(
    holes.map((h) => h.center),
    point,
  );
  if (hole && hole.d <= Math.max(toleranceIn, holeRadiusAt(holes, hole.p))) {
    const h = holes.find((c) => c.center === hole.p)!;
    return { x: h.center.x, y: h.center.y, label: `⌀${fmt(h.diameter)}" hole` };
  }

  const vertex = nearest(entityVertices(entities), point);
  if (vertex && vertex.d <= toleranceIn) {
    return { x: vertex.p.x, y: vertex.p.y, label: "corner" };
  }

  return { x: point.x, y: point.y, label: "point" };
}

/** clicking anywhere inside a hole should snap to it */
function holeRadiusAt(holes: AnalyzedHole[], center: Point): number {
  return (holes.find((h) => h.center === center)?.diameter ?? 0) / 2;
}

function entityVertices(entities: NormalizedEntity[]): Point[] {
  const pts: Point[] = [];
  for (const e of entities) {
    switch (e.kind) {
      case "line":
        pts.push(e.a, e.b);
        break;
      case "polyline":
        for (const v of e.vertices) pts.push({ x: v.x, y: v.y });
        break;
      case "arc":
        pts.push(
          { x: e.center.x + e.radius * Math.cos(e.startAngle), y: e.center.y + e.radius * Math.sin(e.startAngle) },
          { x: e.center.x + e.radius * Math.cos(e.endAngle), y: e.center.y + e.radius * Math.sin(e.endAngle) },
        );
        break;
      default:
        break; // circles are holes; paths are approximations, not real corners
    }
  }
  return pts;
}

function nearest(candidates: Point[], point: Point): { p: Point; d: number } | null {
  let best: { p: Point; d: number } | null = null;
  for (const p of candidates) {
    const d = dist(p, point);
    if (!best || d < best.d) best = { p, d };
  }
  return best;
}

const fmt = (n: number) => parseFloat(n.toFixed(4));
