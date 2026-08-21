import { buildDxf, type DxfEntity } from "./dxf-builder";
import type { DxfExportResponse } from "./types";

/**
 * Face → DXF: a single FeatureScript evaluation returns the face's plane and
 * every boundary edge (analytic where possible, sampled otherwise); this
 * module projects that into 2D and writes the DXF. All math happens here so
 * it stays unit-testable — the FS script only reports geometry.
 */

/**
 * One batched evaluation per export — this is the entire Onshape cost of a
 * DXF. Lines/circles keep analytic form; everything else becomes a 33-point
 * polyline.
 */
export const FACE_EXPORT_SCRIPT = `function(context is Context, queries)
{
    var face = qUnion(queries.face);
    var plane = evFaceTangentPlane(context, { "face" : face, "parameter" : vector(0.5, 0.5) });
    var result = {
        "origin" : plane.origin,
        "xAxis" : plane.x,
        "normal" : plane.normal,
        "edges" : []
    };
    for (var edge in evaluateQuery(context, qAdjacent(face, AdjacencyType.EDGE, EntityType.EDGE)))
    {
        var entry = { "kind" : "other" };
        var tangents = evEdgeTangentLines(context, { "edge" : edge, "parameters" : [0, 0.5, 1] });
        entry.p0 = tangents[0].origin;
        entry.pm = tangents[1].origin;
        entry.p1 = tangents[2].origin;
        try silent
        {
            var def = evCurveDefinition(context, { "edge" : edge });
            if (def is Circle)
            {
                entry.kind = "circle";
                entry.center = def.coordSystem.origin;
                entry.radius = def.radius;
            }
            else if (def is Line)
            {
                entry.kind = "line";
            }
        }
        if (entry.kind == "other")
        {
            var params = [];
            for (var i = 0; i <= 32; i += 1)
            {
                params = append(params, i / 32);
            }
            var pts = [];
            for (var t in evEdgeTangentLines(context, { "edge" : edge, "parameters" : params }))
            {
                pts = append(pts, t.origin);
            }
            entry.points = pts;
        }
        result.edges = append(result.edges, entry);
    }
    return result;
}`;

type Vec3 = [number, number, number];

export interface FaceEdgePlain {
  kind: "line" | "circle" | "other";
  p0: Vec3;
  pm: Vec3;
  p1: Vec3;
  center?: Vec3;
  radius?: number;
  points?: Vec3[];
}

/** Shape of the FS result after fsToPlain, lengths in meters. */
export interface FaceExportPlain {
  origin: Vec3;
  xAxis: Vec3;
  normal: Vec3;
  edges: FaceEdgePlain[];
}

const M_TO_IN = 1 / 0.0254;
/** ~0.0004" — below any shop tolerance */
const EPS = 1e-5;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Angle in degrees, normalized to [0, 360). */
const degOf = (x: number, y: number) => {
  const d = (Math.atan2(y, x) * 180) / Math.PI;
  return d < 0 ? d + 360 : d;
};

/** CCW sweep from a to b in degrees, (0, 360]. */
const ccwSweep = (a: number, b: number) => {
  const s = (b - a) % 360;
  return s <= 0 ? s + 360 : s;
};

export function faceExportToDxf(plain: FaceExportPlain): DxfExportResponse {
  const { origin, xAxis, normal } = plain;
  const yAxis = cross(normal, xAxis);
  // meters → inches, projected into the face plane viewed from +normal
  const to2d = (p: Vec3): [number, number] => {
    const d = sub(p, origin);
    return [dot(d, xAxis) * M_TO_IN, dot(d, yAxis) * M_TO_IN];
  };

  const entities: DxfEntity[] = [];
  for (const edge of plain.edges) {
    if (edge.kind === "line") {
      const [x1, y1] = to2d(edge.p0);
      const [x2, y2] = to2d(edge.p1);
      entities.push({ kind: "line", x1, y1, x2, y2 });
    } else if (edge.kind === "circle" && edge.center && edge.radius !== undefined) {
      const [cx, cy] = to2d(edge.center);
      const r = edge.radius * M_TO_IN;
      const [x0, y0] = to2d(edge.p0);
      const [x1, y1] = to2d(edge.p1);
      const closed = Math.hypot(x1 - x0, y1 - y0) < EPS;
      if (closed) {
        entities.push({ kind: "circle", cx, cy, r });
      } else {
        // DXF arcs sweep CCW start→end; pick the direction containing the midpoint
        const [xm, ym] = to2d(edge.pm);
        const a0 = degOf(x0 - cx, y0 - cy);
        const a1 = degOf(x1 - cx, y1 - cy);
        const am = degOf(xm - cx, ym - cy);
        const midInside = ccwSweep(a0, am) <= ccwSweep(a0, a1);
        entities.push(
          midInside
            ? { kind: "arc", cx, cy, r, startDeg: a0, endDeg: a1 }
            : { kind: "arc", cx, cy, r, startDeg: a1, endDeg: a0 },
        );
      }
    } else {
      const pts = (edge.points ?? [edge.p0, edge.pm, edge.p1]).map(to2d);
      const closed =
        pts.length > 2 &&
        Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < EPS;
      entities.push({ kind: "polyline", points: closed ? pts.slice(0, -1) : pts, closed });
    }
  }

  // envelope + shift so the part sits at (0, 0)
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const e of entities) {
    if (e.kind === "line") {
      grow(e.x1, e.y1);
      grow(e.x2, e.y2);
    } else if (e.kind === "circle") {
      grow(e.cx - e.r, e.cy - e.r);
      grow(e.cx + e.r, e.cy + e.r);
    } else if (e.kind === "arc") {
      // endpoints plus any axis crossing inside the sweep
      const at = (deg: number): [number, number] => [
        e.cx + e.r * Math.cos((deg * Math.PI) / 180),
        e.cy + e.r * Math.sin((deg * Math.PI) / 180),
      ];
      grow(...at(e.startDeg));
      grow(...at(e.endDeg));
      const sweep = ccwSweep(e.startDeg, e.endDeg);
      for (const axis of [0, 90, 180, 270]) {
        if (ccwSweep(e.startDeg, axis) <= sweep) grow(...at(axis));
      }
    } else {
      for (const [x, y] of e.points) grow(x, y);
    }
  }
  if (!Number.isFinite(minX)) throw new Error("Face export produced no geometry");

  const shift = (e: DxfEntity): DxfEntity => {
    switch (e.kind) {
      case "line":
        return { ...e, x1: e.x1 - minX, y1: e.y1 - minY, x2: e.x2 - minX, y2: e.y2 - minY };
      case "circle":
      case "arc":
        return { ...e, cx: e.cx - minX, cy: e.cy - minY };
      case "polyline":
        return { ...e, points: e.points.map(([x, y]) => [x - minX, y - minY] as [number, number]) };
    }
  };

  return {
    dxf: buildDxf(entities.map(shift)),
    envelope: { width: maxX - minX, height: maxY - minY },
  };
}
