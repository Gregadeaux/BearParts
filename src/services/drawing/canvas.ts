import { boxInside, Occupancy } from "./collision";
import type { PathShape, Pt, Shape, TextShape } from "./primitives";
import { textBox, type Box } from "./text-metrics";

/** Sample a path into polylines (Béziers flattened) — for collision checks. */
export function flattenPath(s: PathShape, perCurve = 8): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  let start: Pt | null = null;
  for (const c of s.cmds) {
    if (c.op === "M") {
      if (cur.length > 1) out.push(cur);
      cur = [c.p];
      start = c.p;
    } else if (c.op === "L") {
      cur.push(c.p);
    } else if (c.op === "C") {
      const p0 = cur[cur.length - 1];
      for (let i = 1; i <= perCurve; i++) {
        const t = i / perCurve;
        const u = 1 - t;
        cur.push({
          x: u * u * u * p0.x + 3 * u * u * t * c.c1.x + 3 * u * t * t * c.c2.x + t * t * t * c.p.x,
          y: u * u * u * p0.y + 3 * u * u * t * c.c1.y + 3 * u * t * t * c.c2.y + t * t * t * c.p.y,
        });
      }
    } else if (start) {
      cur.push(start);
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

/**
 * Shape collector that also records every shape as an obstacle, so later
 * annotations are placed around what is already on the sheet.
 */
export class Layer {
  shapes: Shape[] = [];
  constructor(public occ: Occupancy = new Occupancy()) {}

  path(s: PathShape, obstacle = true): PathShape {
    this.shapes.push(s);
    if (obstacle) for (const poly of flattenPath(s)) this.occ.addPolyline(poly);
    return s;
  }

  text(t: TextShape, obstacle = true, pad = 0.03): TextShape {
    this.shapes.push(t);
    if (obstacle) this.occ.addBox(textBox(t, pad));
    return t;
  }

  addAll(shapes: Shape[], obstacle = true) {
    for (const s of shapes) {
      if (s.kind === "path") this.path(s, obstacle);
      else this.text(s, obstacle);
    }
  }

  /**
   * Build an annotation on a scratch layer and keep it only if its text
   * stays inside `region` and clear of everything already drawn, and its
   * lines don't run through existing text.
   */
  tryAdd(region: Box, build: (scratch: Layer) => void): Box | null {
    const scratch = new Layer();
    build(scratch);
    const ext: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const grow = (b: Box) => {
      ext.x0 = Math.min(ext.x0, b.x0);
      ext.y0 = Math.min(ext.y0, b.y0);
      ext.x1 = Math.max(ext.x1, b.x1);
      ext.y1 = Math.max(ext.y1, b.y1);
    };
    for (const s of scratch.shapes) {
      if (s.kind === "text") {
        const b = textBox(s, 0.02);
        if (!boxInside(b, region) || this.occ.boxHits(b)) return null;
        grow(b);
      } else {
        for (const poly of flattenPath(s)) {
          for (let i = 0; i + 1 < poly.length; i++) {
            if (this.occ.segHitsBoxes(poly[i], poly[i + 1])) return null;
            grow({ x0: poly[i].x, y0: poly[i].y, x1: poly[i].x, y1: poly[i].y });
          }
          const last = poly[poly.length - 1];
          grow({ x0: last.x, y0: last.y, x1: last.x, y1: last.y });
        }
      }
    }
    this.addAll(scratch.shapes);
    return ext;
  }
}
