import type { NormalizedEntity, Point, Segment } from "@/types/geometry";
import type { AnalyzedHole } from "@/types/analysis";
import { arcSweep, bulgeToArc, dist, normalizeAngle } from "./geometry";

export interface SnapResult {
  x: number;
  y: number;
  /** human label for the snapped feature, e.g. `⌀0.196" hole` */
  label: string;
  /** characteristic feature size (hole diameter), inches */
  size?: number;
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
    return { x: h.center.x, y: h.center.y, label: `⌀${fmt(h.diameter)}" hole`, size: h.diameter };
  }

  const vertex = nearest(entityVertices(entities), point);
  if (vertex && vertex.d <= toleranceIn) {
    return { x: vertex.p.x, y: vertex.p.y, label: "corner" };
  }

  return { x: point.x, y: point.y, label: "point" };
}

export interface CurveHit {
  radius: number;
  center: Point;
  /** the arc segment itself, for highlighting */
  segment: Extract<Segment, { kind: "arc" }>;
}

/**
 * The curved edge (arc or polyline fillet) under a tap, if any: the point must
 * be within tolerance of the arc's radius AND inside its angular sweep.
 */
export function curveAtPoint(
  entities: NormalizedEntity[],
  point: Point,
  toleranceIn: number,
): CurveHit | null {
  return curveAmongSegments(collectArcSegments(entities), point, toleranceIn);
}

/** Same test against a precomputed segment list — memoize for hover tracking. */
export function curveAmongSegments(
  segments: Extract<Segment, { kind: "arc" }>[],
  point: Point,
  toleranceIn: number,
): CurveHit | null {
  let best: { hit: CurveHit; d: number } | null = null;
  for (const seg of segments) {
    const d = Math.abs(dist(point, seg.center) - seg.radius);
    if (d > toleranceIn || (best && d >= best.d)) continue;
    if (!angleOnArc(seg, point)) continue;
    best = { hit: { radius: seg.radius, center: seg.center, segment: seg }, d };
  }
  return best?.hit ?? null;
}

/** Every tappable arc: standalone ARC entities + polyline fillet bulges. */
export function collectArcSegments(
  entities: NormalizedEntity[],
): Extract<Segment, { kind: "arc" }>[] {
  const segs: Extract<Segment, { kind: "arc" }>[] = [];
  for (const e of entities) {
    if (e.kind === "arc") {
      segs.push({
        kind: "arc",
        a: { x: e.center.x + e.radius * Math.cos(e.startAngle), y: e.center.y + e.radius * Math.sin(e.startAngle) },
        b: { x: e.center.x + e.radius * Math.cos(e.endAngle), y: e.center.y + e.radius * Math.sin(e.endAngle) },
        center: e.center,
        radius: e.radius,
        ccw: true,
      });
    } else if (e.kind === "polyline") {
      const n = e.vertices.length;
      const count = e.closed ? n : n - 1;
      for (let i = 0; i < count; i++) {
        const v = e.vertices[i];
        const w = e.vertices[(i + 1) % n];
        if (Math.abs(v.bulge) < 1e-9) continue;
        const seg = bulgeToArc({ x: v.x, y: v.y }, { x: w.x, y: w.y }, v.bulge);
        if (seg.kind === "arc") segs.push(seg);
      }
    }
  }
  return segs;
}

function angleOnArc(seg: Extract<Segment, { kind: "arc" }>, point: Point): boolean {
  const a0 = Math.atan2(seg.a.y - seg.center.y, seg.a.x - seg.center.x);
  const ap = Math.atan2(point.y - seg.center.y, point.x - seg.center.x);
  let rel = seg.ccw ? ap - a0 : a0 - ap;
  rel = ((normalizeAngle(rel) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return rel <= arcSweep(seg) + 1e-6;
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
