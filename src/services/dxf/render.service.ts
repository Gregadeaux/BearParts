import type { BoundingBox, NormalizedEntity, Point } from "@/types/geometry";
import { bulgeToArc, emptyBBox, expandBBox, finalizeBBox } from "./geometry";

/**
 * Convert normalized entities into SVG path strings (drawing coordinates).
 * The viewer flips Y via a transform, so paths stay in CAD coordinates here.
 */
export function entitiesToSvgPaths(entities: NormalizedEntity[]): string[] {
  return entities.map(entityToPath).filter((p): p is string => p !== null);
}

function entityToPath(e: NormalizedEntity): string | null {
  switch (e.kind) {
    case "line":
      return `M ${fmt(e.a)} L ${fmt(e.b)}`;
    case "circle":
      return (
        `M ${e.center.x + e.radius} ${e.center.y} ` +
        `A ${e.radius} ${e.radius} 0 1 0 ${e.center.x - e.radius} ${e.center.y} ` +
        `A ${e.radius} ${e.radius} 0 1 0 ${e.center.x + e.radius} ${e.center.y} Z`
      );
    case "arc": {
      const a = pointOnCircle(e.center, e.radius, e.startAngle);
      const b = pointOnCircle(e.center, e.radius, e.endAngle);
      let sweep = e.endAngle - e.startAngle;
      while (sweep < 0) sweep += Math.PI * 2;
      const large = sweep > Math.PI ? 1 : 0;
      return `M ${fmt(a)} A ${e.radius} ${e.radius} 0 ${large} 1 ${fmt(b)}`;
    }
    case "polyline": {
      const parts: string[] = [`M ${e.vertices[0].x} ${e.vertices[0].y}`];
      const n = e.vertices.length;
      const count = e.closed ? n : n - 1;
      for (let i = 0; i < count; i++) {
        const v = e.vertices[i];
        const w = e.vertices[(i + 1) % n];
        const seg = bulgeToArc(v, w, v.bulge);
        if (seg.kind === "line") parts.push(`L ${fmt(seg.b)}`);
        else {
          const sweepAngle = 4 * Math.atan(Math.abs(v.bulge));
          const large = sweepAngle > Math.PI ? 1 : 0;
          const sweepFlag = seg.ccw ? 1 : 0;
          parts.push(`A ${seg.radius} ${seg.radius} 0 ${large} ${sweepFlag} ${fmt(seg.b)}`);
        }
      }
      if (e.closed) parts.push("Z");
      return parts.join(" ");
    }
    case "path": {
      if (e.points.length < 2) return null;
      const body = e.points.map((p, i) => `${i === 0 ? "M" : "L"} ${fmt(p)}`).join(" ");
      return e.closed ? `${body} Z` : body;
    }
  }
}

/** Representative points of an entity, used for bounding-box math. */
export function entityPoints(e: NormalizedEntity): Point[] {
  switch (e.kind) {
    case "line":
      return [e.a, e.b];
    case "circle":
      return [
        { x: e.center.x - e.radius, y: e.center.y - e.radius },
        { x: e.center.x + e.radius, y: e.center.y + e.radius },
      ];
    case "arc": {
      const pts = [
        pointOnCircle(e.center, e.radius, e.startAngle),
        pointOnCircle(e.center, e.radius, e.endAngle),
      ];
      // include axis extremes the arc passes through
      let sweep = e.endAngle - e.startAngle;
      while (sweep < 0) sweep += Math.PI * 2;
      for (let q = 0; q < 4; q++) {
        const angle = (q * Math.PI) / 2;
        let rel = angle - e.startAngle;
        while (rel < 0) rel += Math.PI * 2;
        if (rel <= sweep) pts.push(pointOnCircle(e.center, e.radius, angle));
      }
      return pts;
    }
    case "polyline":
      return e.vertices.map((v) => ({ x: v.x, y: v.y }));
    case "path":
      return e.points;
  }
}

export function entitiesBBox(entities: NormalizedEntity[]): BoundingBox {
  const box = emptyBBox();
  for (const e of entities) for (const p of entityPoints(e)) expandBBox(box, p);
  return finalizeBBox(box);
}

/** Scale every coordinate of an entity (e.g. drawing units → inches). */
export function scaleEntity(e: NormalizedEntity, s: number): NormalizedEntity {
  if (s === 1) return e;
  switch (e.kind) {
    case "line":
      return { kind: "line", a: scalePt(e.a, s), b: scalePt(e.b, s) };
    case "circle":
      return { kind: "circle", center: scalePt(e.center, s), radius: e.radius * s };
    case "arc":
      return { ...e, center: scalePt(e.center, s), radius: e.radius * s };
    case "polyline":
      return {
        ...e,
        vertices: e.vertices.map((v) => ({ x: v.x * s, y: v.y * s, bulge: v.bulge })),
      };
    case "path":
      return { ...e, points: e.points.map((p) => scalePt(p, s)) };
  }
}

const scalePt = (p: Point, s: number): Point => ({ x: p.x * s, y: p.y * s });
const fmt = (p: Point) => `${p.x} ${p.y}`;
const pointOnCircle = (c: Point, r: number, angle: number): Point => ({
  x: c.x + r * Math.cos(angle),
  y: c.y + r * Math.sin(angle),
});
