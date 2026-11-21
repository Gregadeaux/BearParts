import type { Pt } from "./primitives";
import type { Box } from "./text-metrics";

/**
 * Obstacle bookkeeping for annotation placement: axis-aligned boxes (text,
 * title block) and line segments (geometry, dimension lines, leaders).
 * Brute force — a drawing has a few thousand obstacles at most.
 */
export class Occupancy {
  boxes: Box[] = [];
  segs: [Pt, Pt][] = [];

  addBox(b: Box) {
    this.boxes.push(b);
  }

  addSeg(a: Pt, b: Pt) {
    this.segs.push([a, b]);
  }

  addPolyline(pts: Pt[], closed = false) {
    for (let i = 0; i + 1 < pts.length; i++) this.addSeg(pts[i], pts[i + 1]);
    if (closed && pts.length > 2) this.addSeg(pts[pts.length - 1], pts[0]);
  }

  /** Does the box touch any obstacle? */
  boxHits(b: Box): boolean {
    for (const o of this.boxes) if (boxesOverlap(b, o)) return true;
    for (const [p, q] of this.segs) if (segHitsBox(p, q, b)) return true;
    return false;
  }

  /** Does the segment cross any box? */
  segHitsBoxes(a: Pt, b: Pt): boolean {
    for (const o of this.boxes) if (segHitsBox(a, b, o)) return true;
    return false;
  }

  /** How many obstacle segments does a→b cross? */
  segCrossings(a: Pt, b: Pt): number {
    let n = 0;
    for (const [p, q] of this.segs) if (segmentsCross(a, b, p, q)) n++;
    return n;
  }
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

export function boxInside(inner: Box, outer: Box): boolean {
  return inner.x0 >= outer.x0 && inner.x1 <= outer.x1 && inner.y0 >= outer.y0 && inner.y1 <= outer.y1;
}

const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Proper or touching intersection of segments ab and cd. */
export function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  const on = (p: Pt, q: Pt, r: Pt) =>
    Math.min(p.x, q.x) - 1e-12 <= r.x &&
    r.x <= Math.max(p.x, q.x) + 1e-12 &&
    Math.min(p.y, q.y) - 1e-12 <= r.y &&
    r.y <= Math.max(p.y, q.y) + 1e-12;
  if (Math.abs(d1) < 1e-14 && on(c, d, a)) return true;
  if (Math.abs(d2) < 1e-14 && on(c, d, b)) return true;
  if (Math.abs(d3) < 1e-14 && on(a, b, c)) return true;
  if (Math.abs(d4) < 1e-14 && on(a, b, d)) return true;
  return false;
}

/** Liang–Barsky clip test: does segment pq touch box b? */
export function segHitsBox(p: Pt, q: Pt, b: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const edges: [number, number][] = [
    [-dx, p.x - b.x0],
    [dx, b.x1 - p.x],
    [-dy, p.y - b.y0],
    [dy, b.y1 - p.y],
  ];
  for (const [pp, qq] of edges) {
    if (Math.abs(pp) < 1e-15) {
      if (qq < 0) return false;
      continue;
    }
    const r = qq / pp;
    if (pp < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/** Even-odd point-in-polygon. */
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export const padBox = (b: Box, pad: number): Box => ({
  x0: b.x0 - pad,
  y0: b.y0 - pad,
  x1: b.x1 + pad,
  y1: b.y1 + pad,
});
