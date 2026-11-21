import type { NormalizedEntity, Point } from "@/types/geometry";
import { bulgeToArc, arcSweep } from "@/services/dxf/geometry";
import type { Layer } from "./canvas";
import { flattenPath } from "./canvas";
import { arc, circle, polyline, type PathCmd, type PathShape, type Pt } from "./primitives";
import { arcCmds } from "./primitives";

/** Model (inches, datum-relative) → sheet mapping for one view. */
export interface ViewXform {
  /** sheet position of the datum (part's lower-left bounding-box corner) */
  ox: number;
  oy: number;
  scale: number;
  minX: number;
  minY: number;
}

export const toPaper = (v: ViewXform, p: Point): Pt => ({
  x: v.ox + (p.x - v.minX) * v.scale,
  y: v.oy + (p.y - v.minY) * v.scale,
});

/**
 * Draw every DXF entity as true vector geometry (thick object lines) and
 * return the flattened sheet polylines for extreme-point lookups.
 */
export function drawEntities(layer: Layer, entities: NormalizedEntity[], v: ViewXform): Pt[][] {
  const polys: Pt[][] = [];
  for (const e of entities) {
    const shape = entityShape(e, v);
    if (!shape) continue;
    layer.path(shape);
    polys.push(...flattenPath(shape, 12));
  }
  return polys;
}

/** The outline as flattened polylines in model inches (no sheet transform). */
export function modelOutline(entities: NormalizedEntity[]): Pt[][] {
  const identity: ViewXform = { ox: 0, oy: 0, scale: 1, minX: 0, minY: 0 };
  return entities.flatMap((e) => {
    const s = entityShape(e, identity);
    return s ? flattenPath(s, 12) : [];
  });
}

function entityShape(e: NormalizedEntity, v: ViewXform): PathShape | null {
  const s = v.scale;
  switch (e.kind) {
    case "line":
      return polyline([toPaper(v, e.a), toPaper(v, e.b)], false, "thick");
    case "circle":
      return circle(toPaper(v, e.center), e.radius * s, "thick");
    case "arc": {
      let sweep = e.endAngle - e.startAngle;
      while (sweep <= 1e-9) sweep += 2 * Math.PI;
      while (sweep > 2 * Math.PI + 1e-9) sweep -= 2 * Math.PI;
      return arc(toPaper(v, e.center), e.radius * s, e.startAngle, sweep, "thick");
    }
    case "polyline": {
      const n = e.vertices.length;
      if (n < 2) return null;
      const cmds: PathCmd[] = [{ op: "M", p: toPaper(v, e.vertices[0]) }];
      for (let i = 0; i < (e.closed ? n : n - 1); i++) {
        const a = e.vertices[i];
        const b = e.vertices[(i + 1) % n];
        if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-9) continue;
        const seg = bulgeToArc({ x: a.x, y: a.y }, { x: b.x, y: b.y }, a.bulge);
        if (seg.kind === "line") cmds.push({ op: "L", p: toPaper(v, seg.b) });
        else {
          const a0 = Math.atan2(seg.a.y - seg.center.y, seg.a.x - seg.center.x);
          const sweep = arcSweep(seg) * (seg.ccw ? 1 : -1);
          cmds.push(...arcCmds(toPaper(v, seg.center), seg.radius * s, a0, sweep));
        }
      }
      if (e.closed) cmds.push({ op: "Z" });
      return { kind: "path", cmds, weight: "thick" };
    }
    case "path":
      if (e.points.length < 2) return null;
      return polyline(e.points.map((p) => toPaper(v, p)), e.closed, "thick");
  }
}

/**
 * Extreme sheet coordinate of the geometry along a line: e.g. the highest y
 * where the outline meets x = value (axis "x", want "max"). Null if the line
 * misses everything.
 */
export function extremeAlong(polys: Pt[][], axis: "x" | "y", value: number, want: "min" | "max"): number | null {
  let best: number | null = null;
  const take = (c: number) => {
    if (best === null || (want === "max" ? c > best : c < best)) best = c;
  };
  const tol = 0.004;
  for (const poly of polys) {
    for (let i = 0; i + 1 < poly.length; i++) {
      const a = poly[i];
      const b = poly[i + 1];
      const [ua, ub, va, vb] = axis === "x" ? [a.x, b.x, a.y, b.y] : [a.y, b.y, a.x, b.x];
      if (Math.abs(ua - value) <= tol) take(va);
      if (Math.abs(ub - value) <= tol) take(vb);
      if ((ua - value) * (ub - value) < 0) take(va + ((value - ua) / (ub - ua)) * (vb - va));
    }
  }
  return best;
}
