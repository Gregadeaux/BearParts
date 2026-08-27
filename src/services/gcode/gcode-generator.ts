import type { NormalizedEntity, Point, Segment } from "@/types/geometry";
import { bulgeToArc, loopSignedArea, pointsEqual } from "../dxf/geometry";

const JOIN_TOL = 1e-4;

/**
 * EXPERIMENTAL: DXF → routed G-code with a single flat endmill.
 *
 * Deliberately simple CAM, per the shop's conventions:
 *  - fastener-sized holes (below the pocket threshold) → center peck plunges
 *  - big holes (bores) → helical-entry spiral pockets, tool-radius compensated
 *  - closed contours → tool-radius offset: the outer boundary cuts outside the
 *    line, interior cutouts cut inside it, corners join with rounding arcs
 *  - open chains → cut on the line (no way to know which side) + warning
 * No tabs, no lead-ins. Inches in, inches out (G20).
 */

export interface GcodeGenOptions {
  /** flat endmill diameter, in */
  toolDiameter: number;
  /** cutting feed, in/min */
  feed: number;
  /** plunge/helix feed, in/min */
  plungeFeed: number;
  spindleRpm: number;
  /** depth per pass, in */
  passDepth: number;
  /** material thickness, in */
  thickness: number;
  /** retract height above stock, in */
  safeZ: number;
  /** holes at or above this diameter are pocketed; smaller ones are plunged */
  pocketThreshold: number;
}

export interface GcodeGenResult {
  gcode: string;
  warnings: string[];
  stats: { plunges: number; pockets: number; contours: number; passes: number };
}

const fmt = (v: number) => {
  const r = Number(v.toFixed(4));
  return Object.is(r, -0) ? "0" : String(r);
};

function reverseSegment(s: Segment): Segment {
  return s.kind === "line"
    ? { kind: "line", a: s.b, b: s.a }
    : { ...s, a: s.b, b: s.a, ccw: !s.ccw };
}

/** Greedy endpoint chaining of loose segments into contours. */
function chainSegments(segments: Segment[]): { segments: Segment[]; closed: boolean }[] {
  const pool = [...segments];
  const chains: { segments: Segment[]; closed: boolean }[] = [];
  const TOL = 2e-3;

  while (pool.length > 0) {
    const chain = [pool.shift()!];
    let extended = true;
    while (extended) {
      extended = false;
      const tail = chain[chain.length - 1].b;
      for (let i = 0; i < pool.length; i++) {
        const s = pool[i];
        if (pointsEqual(s.a, tail, TOL)) {
          chain.push(s);
        } else if (pointsEqual(s.b, tail, TOL)) {
          chain.push(reverseSegment(s));
        } else {
          continue;
        }
        pool.splice(i, 1);
        extended = true;
        break;
      }
    }
    const closed = pointsEqual(chain[0].a, chain[chain.length - 1].b, TOL);
    chains.push({ segments: chain, closed });
  }
  return chains;
}

/**
 * Offset a closed loop by `d` (+ = outward, − = inward), radius-adjusting
 * arcs and joining corners with arcs of radius |d| (shortest sweep). Filleted
 * or tangent corners offset seamlessly; sharp corners get rounded — standard
 * for router work. Returns null when the loop degenerates (slot narrower than
 * the tool).
 */
export function offsetLoop(input: Segment[], d: number): Segment[] | null {
  // normalize to CCW so "outward" is a consistent side
  const ccwLoop =
    loopSignedArea(input) >= 0 ? input : [...input].reverse().map(reverseSegment);

  const offset: Segment[] = [];
  for (const s of ccwLoop) {
    if (s.kind === "line") {
      const len = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
      if (len < 1e-6) continue;
      // right-hand normal = outward for a CCW loop
      const nx = (s.b.y - s.a.y) / len;
      const ny = -(s.b.x - s.a.x) / len;
      offset.push({
        kind: "line",
        a: { x: s.a.x + d * nx, y: s.a.y + d * ny },
        b: { x: s.b.x + d * nx, y: s.b.y + d * ny },
      });
    } else {
      // ccw arc bulges outward (center inside) → outward offset grows it;
      // cw arc is a concave notch (center outside) → outward offset shrinks it
      const r = s.ccw ? s.radius + d : s.radius - d;
      if (r < 1e-4) return null; // feature narrower than the tool
      const scale = (p: Point): Point => {
        const ang = Math.atan2(p.y - s.center.y, p.x - s.center.x);
        return { x: s.center.x + r * Math.cos(ang), y: s.center.y + r * Math.sin(ang) };
      };
      offset.push({ kind: "arc", a: scale(s.a), b: scale(s.b), center: s.center, radius: r, ccw: s.ccw });
    }
  }
  if (offset.length === 0) return null;

  // stitch corners: consecutive offset segments meet the original vertex at
  // distance |d| — bridge gaps with an arc around that vertex
  const joined: Segment[] = [];
  for (let i = 0; i < offset.length; i++) {
    const cur = offset[i];
    const next = offset[(i + 1) % offset.length];
    joined.push(cur);
    if (pointsEqual(cur.b, next.a, JOIN_TOL)) continue;
    const vertex = ccwLoop[i].b; // original corner
    const a0 = Math.atan2(cur.b.y - vertex.y, cur.b.x - vertex.x);
    const a1 = Math.atan2(next.a.y - vertex.y, next.a.x - vertex.x);
    let sweep = a1 - a0;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep <= -Math.PI) sweep += 2 * Math.PI;
    joined.push({
      kind: "arc",
      a: cur.b,
      b: next.a,
      center: vertex,
      radius: Math.abs(d),
      ccw: sweep >= 0,
    });
  }
  return joined;
}

function entityToSegments(e: NormalizedEntity): Segment[] {
  switch (e.kind) {
    case "line":
      return [{ kind: "line", a: e.a, b: e.b }];
    case "arc": {
      const a: Point = {
        x: e.center.x + e.radius * Math.cos(e.startAngle),
        y: e.center.y + e.radius * Math.sin(e.startAngle),
      };
      const b: Point = {
        x: e.center.x + e.radius * Math.cos(e.endAngle),
        y: e.center.y + e.radius * Math.sin(e.endAngle),
      };
      // DXF arcs always run CCW from start to end angle
      return [{ kind: "arc", a, b, center: e.center, radius: e.radius, ccw: true }];
    }
    case "polyline": {
      const segs: Segment[] = [];
      const verts = e.vertices;
      const n = e.closed ? verts.length : verts.length - 1;
      for (let i = 0; i < n; i++) {
        const v = verts[i];
        const w = verts[(i + 1) % verts.length];
        segs.push(bulgeToArc({ x: v.x, y: v.y }, { x: w.x, y: w.y }, v.bulge));
      }
      return segs;
    }
    case "path": {
      const segs: Segment[] = [];
      const pts = e.closed ? [...e.points, e.points[0]] : e.points;
      for (let i = 0; i < pts.length - 1; i++) {
        segs.push({ kind: "line", a: pts[i], b: pts[i + 1] });
      }
      return segs;
    }
    case "circle":
      return []; // circles are handled as bore features
  }
}

export function generateGcode(entities: NormalizedEntity[], opts: GcodeGenOptions): GcodeGenResult {
  const warnings: string[] = [];
  const g: string[] = [];
  const toolR = opts.toolDiameter / 2;
  const bottom = -(opts.thickness + 0.01); // small breakthrough
  const passes = Math.max(1, Math.ceil(Math.abs(bottom) / opts.passDepth));
  const zLevels = Array.from({ length: passes }, (_, i) =>
    Math.max(bottom, -(i + 1) * opts.passDepth),
  );

  const circles = entities
    .filter((e): e is Extract<NormalizedEntity, { kind: "circle" }> => e.kind === "circle")
    .sort((a, b) => a.radius - b.radius);
  const chains = chainSegments(entities.flatMap(entityToSegments));
  // small features first, outer boundary last
  const ordered = [...chains].sort((a, b) => {
    if (a.closed !== b.closed) return a.closed ? 1 : -1;
    return Math.abs(loopSignedArea(a.segments)) - Math.abs(loopSignedArea(b.segments));
  });

  g.push(
    "(BearParts experimental DXF to G-code)",
    `(T1 D=${fmt(opts.toolDiameter)} flat end mill)`,
    "(closed contours are tool-radius offset: outer outside, cutouts inside)",
    "(no tabs - catch your parts)",
    "G20 G90 G94",
    `S${Math.round(opts.spindleRpm)} M3`,
    `G0 Z${fmt(opts.safeZ)}`,
  );

  let plungeCount = 0;
  let pocketCount = 0;
  const stepover = opts.toolDiameter * 0.45;

  for (const c of circles) {
    const rFinal = c.radius - toolR;

    if (c.radius * 2 < opts.pocketThreshold || rFinal < 1e-4) {
      // fastener-sized hole → drill-style peck plunge at center. The hole
      // ends up at tool diameter; drill/ream to final size on the bench.
      if (rFinal < -1e-4 || rFinal > 1e-4) {
        warnings.push(
          `Ø${fmt(c.radius * 2)} at ${fmt(c.center.x)},${fmt(c.center.y)} plunged at tool size (Ø${fmt(opts.toolDiameter)})`,
        );
      }
      plungeCount++;
      g.push(`(plunge Ø${fmt(c.radius * 2)})`, `G0 X${fmt(c.center.x)} Y${fmt(c.center.y)}`);
      for (const z of zLevels) {
        g.push(`G1 Z${fmt(z)} F${fmt(opts.plungeFeed)}`, `G0 Z${fmt(opts.safeZ)}`);
      }
      continue;
    }

    // big hole → spiral-cleared pocket: helical entry, concentric step-out,
    // wall finish pass at the bottom
    pocketCount++;
    const rEntry = Math.min(toolR * 0.5, rFinal);
    g.push(
      `(pocket Ø${fmt(c.radius * 2)})`,
      `G0 X${fmt(c.center.x + rEntry)} Y${fmt(c.center.y)}`,
      `G1 Z0 F${fmt(opts.plungeFeed)}`,
    );
    for (const z of zLevels) {
      // helix one revolution down to this level
      g.push(
        `G3 X${fmt(c.center.x + rEntry)} Y${fmt(c.center.y)} Z${fmt(z)} I${fmt(-rEntry)} J0 F${fmt(opts.plungeFeed)}`,
      );
      // clear outward in stepover rings
      for (let r = Math.min(rEntry + stepover, rFinal); ; r = Math.min(r + stepover, rFinal)) {
        g.push(
          `G1 X${fmt(c.center.x + r)} Y${fmt(c.center.y)} F${fmt(opts.feed)}`,
          `G3 X${fmt(c.center.x + r)} Y${fmt(c.center.y)} I${fmt(-r)} J0 F${fmt(opts.feed)}`,
        );
        if (r >= rFinal - 1e-6) break;
      }
      // back to entry radius for the next helix down
      g.push(`G1 X${fmt(c.center.x + rEntry)} Y${fmt(c.center.y)} F${fmt(opts.feed)}`);
    }
    // finish the wall at full depth, clear it, retract
    g.push(
      `G1 X${fmt(c.center.x + rFinal)} Y${fmt(c.center.y)} F${fmt(opts.feed)}`,
      `G3 X${fmt(c.center.x + rFinal)} Y${fmt(c.center.y)} I${fmt(-rFinal)} J0 F${fmt(opts.feed)}`,
      `G1 X${fmt(c.center.x)} Y${fmt(c.center.y)} F${fmt(opts.feed)}`,
      `G0 Z${fmt(opts.safeZ)}`,
    );
  }

  // the biggest closed loop is the part's outer boundary; everything else
  // closed is a cutout
  const closedAreas = ordered
    .filter((c) => c.closed)
    .map((c) => Math.abs(loopSignedArea(c.segments)));
  const outerArea = closedAreas.length > 0 ? Math.max(...closedAreas) : 0;

  let contourCount = 0;
  for (const chain of ordered) {
    if (chain.segments.length === 0) continue;

    let path = chain.segments;
    let label = "open - cut on line";
    if (chain.closed) {
      const isOuter = Math.abs(Math.abs(loopSignedArea(chain.segments)) - outerArea) < 1e-9;
      const offset = offsetLoop(chain.segments, isOuter ? toolR : -toolR);
      if (!offset) {
        warnings.push("Skipped a cutout narrower than the tool");
        continue;
      }
      path = offset;
      label = isOuter ? "outer profile - offset outside" : "cutout - offset inside";
    } else {
      warnings.push("Open contour cut on the line (no offset side known)");
    }

    contourCount++;
    const start = path[0].a;
    g.push(`(contour ${contourCount}: ${label})`, `G0 X${fmt(start.x)} Y${fmt(start.y)}`);
    for (const z of zLevels) {
      g.push(`G1 Z${fmt(z)} F${fmt(opts.plungeFeed)}`);
      for (const s of path) {
        if (s.kind === "line") {
          g.push(`G1 X${fmt(s.b.x)} Y${fmt(s.b.y)} F${fmt(opts.feed)}`);
        } else {
          const code = s.ccw ? "G3" : "G2";
          g.push(
            `${code} X${fmt(s.b.x)} Y${fmt(s.b.y)} I${fmt(s.center.x - s.a.x)} J${fmt(s.center.y - s.a.y)} F${fmt(opts.feed)}`,
          );
        }
      }
      if (!chain.closed || z !== zLevels[zLevels.length - 1]) {
        // open chains (and every non-final pass) return to the start point
        g.push(`G0 Z${fmt(opts.safeZ)}`, `G0 X${fmt(start.x)} Y${fmt(start.y)}`);
      }
    }
    g.push(`G0 Z${fmt(opts.safeZ)}`);
  }

  if (plungeCount === 0 && pocketCount === 0 && contourCount === 0) {
    warnings.push("Nothing cuttable found in this DXF");
  }

  g.push("M5", "G0 Z" + fmt(opts.safeZ), "M30", "");
  return {
    gcode: g.join("\r\n"),
    warnings,
    stats: { plunges: plungeCount, pockets: pocketCount, contours: contourCount, passes },
  };
}
