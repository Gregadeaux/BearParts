import type { BoundingBox, Point, Segment } from "@/types/geometry";

export const EPS = 1e-6;

export function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function pointsEqual(a: Point, b: Point, tol = 1e-4): boolean {
  return Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
}

/**
 * Convert a polyline bulge segment (DXF bulge = tan(sweep/4)) into an arc.
 * Positive bulge sweeps counter-clockwise from a to b.
 */
export function bulgeToArc(a: Point, b: Point, bulge: number): Segment {
  if (Math.abs(bulge) < EPS) return { kind: "line", a, b };
  const chord = dist(a, b);
  const sweep = 4 * Math.atan(bulge);
  const radius = Math.abs(chord / (2 * Math.sin(sweep / 2)));
  // perpendicular offset from chord midpoint to arc center
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const h = Math.sqrt(Math.max(0, radius * radius - (chord / 2) ** 2));
  // unit vector along chord, rotated 90° CCW
  const ux = (b.x - a.x) / chord;
  const uy = (b.y - a.y) / chord;
  // center is left of chord for CCW arcs <180°, right for >180° (sign dance below)
  const side = bulge > 0 ? 1 : -1;
  const flip = Math.abs(sweep) > Math.PI ? -1 : 1;
  const center = {
    x: mid.x + side * flip * h * -uy,
    y: mid.y + side * flip * h * ux,
  };
  return { kind: "arc", a, b, center, radius, ccw: bulge > 0 };
}

/** Signed area of a closed segment loop (positive = CCW). Includes arc circular-segment corrections. */
export function loopSignedArea(segments: Segment[]): number {
  let area = 0;
  for (const s of segments) {
    // shoelace contribution of the chord
    area += (s.a.x * s.b.y - s.b.x * s.a.y) / 2;
    if (s.kind === "arc") {
      const sweep = arcSweep(s);
      // circular segment between chord and arc
      const seg = (s.radius * s.radius * (sweep - Math.sin(sweep))) / 2;
      area += s.ccw ? seg : -seg;
    }
  }
  return area;
}

/** Absolute sweep angle (0..2π) of an arc segment. */
export function arcSweep(s: Extract<Segment, { kind: "arc" }>): number {
  const a0 = Math.atan2(s.a.y - s.center.y, s.a.x - s.center.x);
  const a1 = Math.atan2(s.b.y - s.center.y, s.b.x - s.center.x);
  let sweep = s.ccw ? a1 - a0 : a0 - a1;
  while (sweep <= EPS) sweep += 2 * Math.PI;
  while (sweep > 2 * Math.PI) sweep -= 2 * Math.PI;
  return sweep;
}

/** Outgoing direction (radians) at the start of a segment. */
export function startTangent(s: Segment): number {
  if (s.kind === "line") return Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x);
  const radial = Math.atan2(s.a.y - s.center.y, s.a.x - s.center.x);
  return radial + (s.ccw ? Math.PI / 2 : -Math.PI / 2);
}

/** Incoming direction (radians) at the end of a segment. */
export function endTangent(s: Segment): number {
  if (s.kind === "line") return Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x);
  const radial = Math.atan2(s.b.y - s.center.y, s.b.x - s.center.x);
  return radial + (s.ccw ? Math.PI / 2 : -Math.PI / 2);
}

/** Normalize an angle to (-π, π]. */
export function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

export function emptyBBox(): { min: Point; max: Point } {
  return {
    min: { x: Infinity, y: Infinity },
    max: { x: -Infinity, y: -Infinity },
  };
}

export function expandBBox(b: { min: Point; max: Point }, p: Point): void {
  b.min.x = Math.min(b.min.x, p.x);
  b.min.y = Math.min(b.min.y, p.y);
  b.max.x = Math.max(b.max.x, p.x);
  b.max.y = Math.max(b.max.y, p.y);
}

export function finalizeBBox(b: { min: Point; max: Point }): BoundingBox {
  if (!isFinite(b.min.x)) {
    return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 }, width: 0, height: 0 };
  }
  return { ...b, width: b.max.x - b.min.x, height: b.max.y - b.min.y };
}
