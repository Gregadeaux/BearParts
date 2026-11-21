import type { AnalyzedHole, DxfAnalysis } from "@/types/analysis";
import type { Loop, NormalizedEntity, Point, Segment } from "@/types/geometry";
import { buildLoops, loopAsCircle } from "@/services/dxf/loop-builder";
import { arcSweep, bulgeToArc, dist, endTangent, normalizeAngle, startTangent } from "@/services/dxf/geometry";

const TANGENT_TOL = (1 * Math.PI) / 180;
/** turns this gentle between short lines mean a sampled curve (spline/ellipse) */
const FACET_TURN = (15 * Math.PI) / 180;

/** A point the ordinate scheme must locate to fully define a contour. */
export interface ProfilePoint extends Point {
  kind: "corner" | "virtual-sharp" | "arc-center";
}

export interface RadiusFeature {
  radius: number;
  center: Point;
  /** arc midpoint — where the radius leader lands */
  mid: Point;
}

export interface DxfFeatures {
  holes: AnalyzedHole[];
  /** a circular outer profile (round spacer), pulled out of `holes` */
  outerCircle: AnalyzedHole | null;
  points: ProfilePoint[];
  radii: RadiusFeature[];
  /** some contour geometry can't be located by points + radii (splines, loose lines) */
  freeform: boolean;
  /** the outer profile as a polygon (arcs sampled), for "inside the part" tests */
  outline: Point[] | null;
}

/** Contour features of a DXF part, in the same (inch) coordinates as the entities. */
export function extractFeatures(entities: NormalizedEntity[], analysis: DxfAnalysis): DxfFeatures {
  const loops = buildLoops(entities).filter((l) => !loopAsCircle(l));
  const points: ProfilePoint[] = [];
  const radii: RadiusFeature[] = [];
  let freeform = false;

  for (const loop of loops) {
    const r = loopFeatures(loop);
    if (r === null) freeform = true;
    else {
      points.push(...r.points);
      radii.push(...r.radii);
    }
  }

  const loopLength = loops.reduce((s, l) => s + l.segments.reduce((t, g) => t + segLength(g), 0), 0);
  const contourLength = entities.reduce((s, e) => s + (e.kind === "circle" ? 0 : entityLength(e)), 0);
  const circleLoopLength = buildLoops(entities)
    .filter((l) => loopAsCircle(l))
    .reduce((s, l) => s + l.segments.reduce((t, g) => t + segLength(g), 0), 0);
  if (contourLength - circleLoopLength - loopLength > Math.max(1e-3, contourLength * 1e-3)) {
    freeform = true; // open chains / loose construction lines
  }

  const { width, height } = analysis.boundingBox;
  const extent = Math.max(width, height);
  const outerCircle =
    analysis.holes.find((h) => h.diameter >= extent - 1e-3 && loops.length === 0) ?? null;
  const holes = analysis.holes.filter((h) => h !== outerCircle);
  const outer = loops.reduce<Loop | null>((a, l) => (!a || Math.abs(l.area) > Math.abs(a.area) ? l : a), null);
  return { holes, outerCircle, points: dedupePoints(points), radii, freeform, outline: outer ? sampleLoop(outer) : null };
}

function sampleLoop(loop: Loop): Point[] {
  const out: Point[] = [];
  for (const s of loop.segments) {
    out.push(s.a);
    if (s.kind !== "arc") continue;
    const a0 = Math.atan2(s.a.y - s.center.y, s.a.x - s.center.x);
    const sweep = arcSweep(s) * (s.ccw ? 1 : -1);
    for (let i = 1; i < 8; i++) {
      const t = a0 + (sweep * i) / 8;
      out.push({ x: s.center.x + s.radius * Math.cos(t), y: s.center.y + s.radius * Math.sin(t) });
    }
  }
  return out;
}

function loopFeatures(loop: Loop): { points: ProfilePoint[]; radii: RadiusFeature[] } | null {
  const segs = loop.segments;
  const n = segs.length;
  const points: ProfilePoint[] = [];
  const radii: RadiusFeature[] = [];
  let facets = 0;

  const turnAt = (i: number) => normalizeAngle(startTangent(segs[(i + 1) % n]) - endTangent(segs[i]));
  const tangentAt = (i: number) => Math.abs(turnAt(i)) < TANGENT_TOL;

  for (let i = 0; i < n; i++) {
    const s = segs[i];
    const next = segs[(i + 1) % n];
    const turn = Math.abs(turnAt(i));
    if (s.kind === "line" && next.kind === "line" && turn >= TANGENT_TOL && turn < FACET_TURN) facets++;
    if (!tangentAt(i)) points.push({ ...s.b, kind: "corner" });

    if (s.kind !== "arc") continue;
    radii.push({ radius: s.radius, center: s.center, mid: arcMid(s) });
    const prev = segs[(i - 1 + n) % n];
    const sharp =
      prev.kind === "line" && next.kind === "line" && tangentAt((i - 1 + n) % n) && tangentAt(i)
        ? lineIntersection(prev, next)
        : null;
    if (sharp && arcSweep(s) < Math.PI - 1e-3) points.push({ ...sharp, kind: "virtual-sharp" });
    else points.push({ ...s.center, kind: "arc-center" });
  }
  // a sampled spline/ellipse: dozens of nearly-straight facets
  if (facets >= 4) return null;
  return { points, radii };
}

function arcMid(s: Extract<Segment, { kind: "arc" }>): Point {
  const a0 = Math.atan2(s.a.y - s.center.y, s.a.x - s.center.x);
  const sweep = arcSweep(s);
  const m = a0 + (s.ccw ? sweep / 2 : -sweep / 2);
  return { x: s.center.x + s.radius * Math.cos(m), y: s.center.y + s.radius * Math.sin(m) };
}

/** Intersection of the infinite lines through two segments, or null if parallel. */
export function lineIntersection(l1: Segment, l2: Segment): Point | null {
  const d1 = { x: l1.b.x - l1.a.x, y: l1.b.y - l1.a.y };
  const d2 = { x: l2.b.x - l2.a.x, y: l2.b.y - l2.a.y };
  const den = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(den) < 1e-9 * (Math.hypot(d1.x, d1.y) * Math.hypot(d2.x, d2.y) + 1e-12)) return null;
  const t = ((l2.a.x - l1.a.x) * d2.y - (l2.a.y - l1.a.y) * d2.x) / den;
  return { x: l1.a.x + t * d1.x, y: l1.a.y + t * d1.y };
}

function dedupePoints(pts: ProfilePoint[]): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  for (const p of pts) if (!out.some((q) => dist(p, q) < 1e-4)) out.push(p);
  return out;
}

const segLength = (s: Segment) => (s.kind === "line" ? dist(s.a, s.b) : s.radius * arcSweep(s));

function entityLength(e: NormalizedEntity): number {
  switch (e.kind) {
    case "line":
      return dist(e.a, e.b);
    case "circle":
      return 2 * Math.PI * e.radius;
    case "arc": {
      let sweep = e.endAngle - e.startAngle;
      while (sweep <= 0) sweep += 2 * Math.PI;
      return e.radius * sweep;
    }
    case "polyline": {
      let total = 0;
      const n = e.vertices.length;
      for (let i = 0; i < (e.closed ? n : n - 1); i++) {
        const a = e.vertices[i];
        const b = e.vertices[(i + 1) % n];
        if (dist(a, b) < 1e-9) continue;
        total += segLength(bulgeToArc(a, b, a.bulge));
      }
      return total;
    }
    case "path": {
      let total = 0;
      for (let i = 1; i < e.points.length; i++) total += dist(e.points[i - 1], e.points[i]);
      if (e.closed && e.points.length > 2) total += dist(e.points[e.points.length - 1], e.points[0]);
      return total;
    }
  }
}
