import DxfParser from "dxf-parser";
import type { NormalizedEntity, Point } from "@/types/geometry";

/** DXF $INSUNITS values we care about → scale factor to inches. */
const INSUNITS_TO_INCH: Record<number, number> = {
  1: 1, // inches
  2: 12, // feet
  4: 1 / 25.4, // mm
  5: 1 / 2.54, // cm
  6: 1 / 0.0254, // m
};

export type RawUnits = "in" | "mm" | "unknown";

export interface DxfDocument {
  /** entities in original drawing units, transforms (INSERTs) applied */
  entities: NormalizedEntity[];
  /** units declared in the DXF header, if any */
  headerUnits: RawUnits;
  /** scale factor from drawing units to inches when header units are known */
  headerScaleToInch: number | null;
  entityCounts: Record<string, number>;
  warnings: string[];
}

interface Transform {
  x: number;
  y: number;
  rotation: number; // radians
  scale: number;
}

const IDENTITY: Transform = { x: 0, y: 0, rotation: 0, scale: 1 };

/**
 * Parse DXF text into flat, transform-applied 2D entities.
 * Block INSERTs are expanded recursively (uniform scale assumed).
 */
export function parseDxf(text: string): DxfDocument {
  const parser = new DxfParser();
  const dxf = parser.parse(text);
  if (!dxf) throw new Error("Could not parse DXF file");

  const warnings: string[] = [];
  const entityCounts: Record<string, number> = {};
  const out: NormalizedEntity[] = [];

  const insunits = (dxf.header?.["$INSUNITS"] as number | undefined) ?? 0;
  const headerScaleToInch = INSUNITS_TO_INCH[insunits] ?? null;
  const headerUnits: RawUnits =
    insunits === 1 ? "in" : insunits === 4 ? "mm" : headerScaleToInch ? "in" : "unknown";

  const visit = (entities: unknown[], t: Transform, depth: number) => {
    if (depth > 8) return; // guard against cyclic block references
    for (const raw of entities ?? []) {
      const e = raw as Record<string, unknown> & { type: string };
      entityCounts[e.type] = (entityCounts[e.type] ?? 0) + 1;
      const converted = convertEntity(e, t, dxf.blocks, visit, warnings);
      if (converted) out.push(...converted);
    }
  };
  visit(dxf.entities as unknown[], IDENTITY, 0);

  return { entities: out, headerUnits, headerScaleToInch, entityCounts, warnings };
}

function apply(t: Transform, p: { x: number; y: number }): Point {
  const c = Math.cos(t.rotation);
  const s = Math.sin(t.rotation);
  const x = p.x * t.scale;
  const y = p.y * t.scale;
  return { x: x * c - y * s + t.x, y: x * s + y * c + t.y };
}

type Visitor = (entities: unknown[], t: Transform, depth: number) => void;

function convertEntity(
  e: Record<string, unknown> & { type: string },
  t: Transform,
  blocks: unknown,
  visit: Visitor,
  warnings: string[],
  depth = 0,
): NormalizedEntity[] | null {
  switch (e.type) {
    case "LINE": {
      const v = e.vertices as Point[];
      if (!v || v.length < 2) return null;
      return [{ kind: "line", a: apply(t, v[0]), b: apply(t, v[1]) }];
    }
    case "CIRCLE": {
      const center = apply(t, e.center as Point);
      return [{ kind: "circle", center, radius: (e.radius as number) * t.scale }];
    }
    case "ARC": {
      const center = apply(t, e.center as Point);
      return [
        {
          kind: "arc",
          center,
          radius: (e.radius as number) * t.scale,
          startAngle: (e.startAngle as number) + t.rotation,
          endAngle: (e.endAngle as number) + t.rotation,
        },
      ];
    }
    case "LWPOLYLINE":
    case "POLYLINE": {
      const verts = (e.vertices as { x: number; y: number; bulge?: number }[]) ?? [];
      if (verts.length < 2) return null;
      return [
        {
          kind: "polyline",
          vertices: verts.map((v) => {
            const p = apply(t, v);
            return { x: p.x, y: p.y, bulge: v.bulge ?? 0 };
          }),
          closed: Boolean(e.shape) || Boolean((e as { closed?: boolean }).closed),
        },
      ];
    }
    case "ELLIPSE": {
      const pts = sampleEllipse(e, 64).map((p) => apply(t, p));
      return [{ kind: "path", points: pts, closed: isFullEllipse(e) }];
    }
    case "SPLINE": {
      const pts = sampleSpline(e, 64);
      if (!pts) {
        warnings.push("A spline could not be interpreted and was skipped.");
        return null;
      }
      return [
        {
          kind: "path",
          points: pts.map((p) => apply(t, p)),
          closed: Boolean(e.closed),
        },
      ];
    }
    case "INSERT": {
      const name = e.name as string;
      const block = (blocks as Record<string, { entities?: unknown[] }>)?.[name];
      if (!block?.entities) return null;
      const pos = (e.position as Point) ?? { x: 0, y: 0 };
      const rot = (((e.rotation as number) ?? 0) * Math.PI) / 180;
      const scale = (e.xScale as number) ?? 1;
      const yScale = (e.yScale as number) ?? scale;
      if (Math.abs(scale - yScale) > 1e-6) {
        warnings.push(`Block "${name}" uses non-uniform scale; geometry may be approximate.`);
      }
      const placed = apply(t, pos);
      visit(
        block.entities,
        { x: placed.x, y: placed.y, rotation: t.rotation + rot, scale: t.scale * scale },
        depth + 1,
      );
      return null;
    }
    default:
      return null; // TEXT, DIMENSION, etc. — not geometry we machine
  }
}

function isFullEllipse(e: Record<string, unknown>): boolean {
  const start = (e.startAngle as number) ?? 0;
  const end = (e.endAngle as number) ?? Math.PI * 2;
  return Math.abs(end - start - Math.PI * 2) < 1e-6;
}

function sampleEllipse(e: Record<string, unknown>, n: number): Point[] {
  const center = e.center as Point;
  const major = e.majorAxisEndPoint as Point;
  const ratio = e.axisRatio as number;
  const start = (e.startAngle as number) ?? 0;
  let end = (e.endAngle as number) ?? Math.PI * 2;
  if (end <= start) end += Math.PI * 2;
  const a = Math.hypot(major.x, major.y);
  const b = a * ratio;
  const phi = Math.atan2(major.y, major.x);
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const u = start + ((end - start) * i) / n;
    const px = a * Math.cos(u);
    const py = b * Math.sin(u);
    pts.push({
      x: center.x + px * Math.cos(phi) - py * Math.sin(phi),
      y: center.y + px * Math.sin(phi) + py * Math.cos(phi),
    });
  }
  return pts;
}

/** Approximate a spline: prefer fit points, else evaluate the B-spline via de Boor. */
function sampleSpline(e: Record<string, unknown>, n: number): Point[] | null {
  const fit = e.fitPoints as Point[] | undefined;
  if (fit && fit.length >= 2) return fit.map((p) => ({ x: p.x, y: p.y }));
  const ctrl = e.controlPoints as Point[] | undefined;
  const degree = (e.degreeOfSplineCurve as number) ?? 3;
  const knots = e.knotValues as number[] | undefined;
  if (!ctrl || ctrl.length < 2) return null;
  if (!knots || knots.length !== ctrl.length + degree + 1) {
    return ctrl.map((p) => ({ x: p.x, y: p.y })); // fall back to control polygon
  }
  const pts: Point[] = [];
  const tMin = knots[degree];
  const tMax = knots[knots.length - 1 - degree];
  for (let i = 0; i <= n; i++) {
    const u = tMin + ((tMax - tMin) * i) / n;
    pts.push(deBoor(u, degree, ctrl, knots));
  }
  return pts;
}

function deBoor(u: number, p: number, ctrl: Point[], knots: number[]): Point {
  let k = knots.length - p - 2;
  for (let i = p; i < knots.length - p - 1; i++) {
    if (u >= knots[i] && u <= knots[i + 1]) {
      k = i;
      break;
    }
  }
  const d: Point[] = [];
  for (let j = 0; j <= p; j++) {
    const c = ctrl[Math.min(Math.max(j + k - p, 0), ctrl.length - 1)];
    d.push({ x: c.x, y: c.y });
  }
  for (let r = 1; r <= p; r++) {
    for (let j = p; j >= r; j--) {
      const i = j + k - p;
      const denom = knots[i + p - r + 1] - knots[i];
      const alpha = denom === 0 ? 0 : (u - knots[i]) / denom;
      d[j] = {
        x: (1 - alpha) * d[j - 1].x + alpha * d[j].x,
        y: (1 - alpha) * d[j - 1].y + alpha * d[j].y,
      };
    }
  }
  return d[p];
}
