import type { Loop, NormalizedEntity, Point, Segment } from "@/types/geometry";
import { bulgeToArc, dist, loopSignedArea, pointsEqual } from "./geometry";

const JOIN_TOL = 5e-3; // drawing-unit tolerance for chaining endpoints

/**
 * Build closed loops from loose lines/arcs and closed polylines.
 * Open chains that never close are dropped (they're usually construction geometry).
 */
export function buildLoops(entities: NormalizedEntity[]): Loop[] {
  const loops: Loop[] = [];
  const loose: Segment[] = [];

  for (const e of entities) {
    if (e.kind === "polyline") {
      const segs = polylineSegments(e);
      if (e.closed && segs.length > 0) loops.push(makeLoop(segs));
      else loose.push(...segs);
    } else if (e.kind === "line") {
      loose.push({ kind: "line", a: e.a, b: e.b });
    } else if (e.kind === "arc") {
      loose.push(arcToSegment(e));
    } else if (e.kind === "path" && e.closed && e.points.length >= 3) {
      loops.push(makeLoop(pathSegments(e.points)));
    }
  }

  loops.push(...chainLooseSegments(loose));
  return loops;
}

function polylineSegments(e: Extract<NormalizedEntity, { kind: "polyline" }>): Segment[] {
  const segs: Segment[] = [];
  const n = e.vertices.length;
  const count = e.closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const a = e.vertices[i];
    const b = e.vertices[(i + 1) % n];
    if (pointsEqual(a, b)) continue;
    segs.push(bulgeToArc({ x: a.x, y: a.y }, { x: b.x, y: b.y }, a.bulge));
  }
  return segs;
}

function pathSegments(points: Point[]): Segment[] {
  const segs: Segment[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (!pointsEqual(a, b)) segs.push({ kind: "line", a, b });
  }
  return segs;
}

function arcToSegment(e: Extract<NormalizedEntity, { kind: "arc" }>): Segment {
  const a = {
    x: e.center.x + e.radius * Math.cos(e.startAngle),
    y: e.center.y + e.radius * Math.sin(e.startAngle),
  };
  const b = {
    x: e.center.x + e.radius * Math.cos(e.endAngle),
    y: e.center.y + e.radius * Math.sin(e.endAngle),
  };
  return { kind: "arc", a, b, center: e.center, radius: e.radius, ccw: true };
}

function reverse(s: Segment): Segment {
  if (s.kind === "line") return { kind: "line", a: s.b, b: s.a };
  return { ...s, a: s.b, b: s.a, ccw: !s.ccw };
}

/** Greedy endpoint-matching chain builder. */
function chainLooseSegments(loose: Segment[]): Loop[] {
  const used = new Array(loose.length).fill(false);
  const loops: Loop[] = [];

  for (let i = 0; i < loose.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const chain: Segment[] = [loose[i]];

    let guard = loose.length + 1;
    while (guard-- > 0) {
      const tail = chain[chain.length - 1].b;
      if (chain.length > 1 && pointsEqual(tail, chain[0].a, JOIN_TOL)) break;
      const nextIdx = loose.findIndex(
        (s, j) =>
          !used[j] && (pointsEqual(s.a, tail, JOIN_TOL) || pointsEqual(s.b, tail, JOIN_TOL)),
      );
      if (nextIdx === -1) break;
      used[nextIdx] = true;
      const s = loose[nextIdx];
      chain.push(pointsEqual(s.a, tail, JOIN_TOL) ? s : reverse(s));
    }

    const closed =
      chain.length > 0 && dist(chain[chain.length - 1].b, chain[0].a) <= JOIN_TOL;
    if (closed && chain.length >= 1) loops.push(makeLoop(chain));
  }
  return loops;
}

function makeLoop(segments: Segment[]): Loop {
  return { segments, area: loopSignedArea(segments) };
}

/**
 * If a loop is really a full circle (arcs sharing one center/radius), return it.
 * Catches bearing holes drawn as two half-arcs or filleted "circles".
 */
export function loopAsCircle(loop: Loop): { center: Point; radius: number } | null {
  if (loop.segments.length === 0) return null;
  const first = loop.segments[0];
  if (first.kind !== "arc") return null;
  const { center, radius } = first;
  const tol = Math.max(1e-4, radius * 1e-3);
  for (const s of loop.segments) {
    if (s.kind !== "arc") return null;
    if (dist(s.center, center) > tol || Math.abs(s.radius - radius) > tol) return null;
  }
  return { center, radius };
}
