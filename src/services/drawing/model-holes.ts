import type { HolePattern, ModelCylinder, ModelFeatures } from "@/services/dimensions/model-features";
import type { Layer } from "./canvas";
import { CalloutPlacer, circleAnchors, type CalloutLine } from "./callouts";
import { centerDashes, centerMark, DIM, ordinateDim } from "./dims";
import { ORD_GAP, MAX_ORDINATES } from "./dxf-plan";
import { extremeAlong } from "./dxf-view";
import { countPrefix, fmtIn, fmtOrdinate } from "./format";
import type { V3 } from "./hlr";
import { dedupeValues, spreadLabels } from "./layout-math";
import { project, v3, viewPolys, type PlacedView } from "./model-views";
import { line, polar, pt, type Pt } from "./primitives";
import { DEPTH, DIA } from "./text-metrics";

/** Callout text for a hole pattern: count, ⌀, THRU or depth, bolt circle. */
export function holeLines(h: HolePattern, cyls: ModelCylinder[]): CalloutLine[] {
  const m = h.members.map((i) => cyls[i]);
  const depths = m.map((c) => c.extent[1] - c.extent[0]);
  const sameDepth = depths.every((d) => Math.abs(d - depths[0]) < 0.001);
  // THRU only when every end is open; a depth only when every hole agrees
  const end = h.thru ? " THRU" : m.every((c) => c.blind) && sameDepth ? ` ${DEPTH}${fmtIn(depths[0])}` : "";
  const lines: CalloutLine[] = [{ text: `${countPrefix(h.count)}${DIA}${fmtIn(h.diameter)}${end}`, size: DIM.textH }];
  if (h.boltCircle) lines.push({ text: `EQ SP ON ${DIA}${fmtIn(h.boltCircle.diameter)} B.C.`, size: DIM.textH });
  return lines;
}

/** The orthographic view looking straight down `axis`, if any. */
export function axisView(views: PlacedView[], axis: V3): PlacedView | null {
  return views.find((v) => v.key !== "iso" && Math.abs(v.basis.fwd[0] * axis[0] + v.basis.fwd[1] * axis[1] + v.basis.fwd[2] * axis[2]) > 0.999) ?? null;
}

/** Hole center at the end facing the viewer, and whether its rim is visible there. */
export function holeFace(pv: PlacedView, c: ModelCylinder): { center: V3; visible: boolean } {
  const a = v3(c.axis), o = v3(c.origin), f = pv.basis.fwd;
  const ends = c.extent.map((t) => [o[0] + a[0] * t, o[1] + a[1] * t, o[2] + a[2] * t] as V3);
  const depth = (p: V3) => p[0] * f[0] + p[1] * f[1] + p[2] * f[2];
  const center = depth(ends[0]) < depth(ends[1]) ? ends[0] : ends[1];
  // probe just outside the rim, on the face the hole opens into
  const u: V3 = Math.abs(a[0]) < 0.9 ? [0, a[2], -a[1]] : [a[1], -a[0], 0];
  const ul = Math.hypot(...u);
  const w: V3 = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  const r = (c.diameter / 2) * 1.08 + 0.005;
  let seen = 0;
  for (let k = 0; k < 8; k++) {
    const th = (k * Math.PI) / 4;
    const cs = (Math.cos(th) * r) / ul, sn = (Math.sin(th) * r) / ul;
    if (pv.view.probe([center[0] + u[0] * cs + w[0] * sn, center[1] + u[1] * cs + w[1] * sn, center[2] + u[2] * cs + w[2] * sn])) seen++;
  }
  return { center, visible: seen >= 5 };
}

/**
 * Callouts for every hole pattern in the view down its axis: center marks,
 * the bolt circle as a center line, one leader per pattern. Returns the
 * patterns that got a callout (others stay under the CAD-model note).
 */
export function calloutHoles(layer: Layer, placer: CalloutPlacer, f: ModelFeatures, views: PlacedView[], skip: (h: HolePattern) => boolean): Set<HolePattern> {
  const done = new Set<HolePattern>();
  for (const h of f.holes) {
    if (skip(h)) continue;
    const pv = axisView(views, v3(h.axis));
    if (!pv) continue;
    const faces = h.members.map((i) => holeFace(pv, f.cylinders[i]));
    if (faces.some((x) => !x.visible)) continue;
    const r = (h.diameter / 2) * pv.scale;
    const centers = faces.map((x) => project(pv, x.center));
    for (const c of centers) centerMark(layer, c, r);
    if (h.boltCircle) boltCircleLine(layer, project(pv, v3(h.boltCircle.center)), (h.boltCircle.diameter / 2) * pv.scale);
    if (placer.place(holeLines(h, f.cylinders), centers.flatMap((c) => circleAnchors(c, r)))) done.add(h);
  }
  return done;
}

/** Bolt circle drawn as a long-dash/short-dash center line. */
function boltCircleLine(layer: Layer, c: Pt, R: number) {
  const circumference = 2 * Math.PI * R;
  for (const [a, b] of centerDashes(0, circumference)) {
    const steps = Math.max(2, Math.ceil(((b - a) / R) * 8));
    for (let i = 0; i < steps; i++) {
      layer.path(line(polar(c, R, (a + ((b - a) * i) / steps) / R), polar(c, R, (a + ((b - a) * (i + 1)) / steps) / R)));
    }
  }
}

/**
 * Locate holes in TOP by ordinates from its lower-left corner: X values
 * above the view, Y values to its left. A bolt circle is located by its
 * center. Returns false (leaving them to the note) when it would crowd.
 */
export function locateInTop(layer: Layer, top: PlacedView, f: ModelFeatures, patterns: HolePattern[]): boolean {
  const pts: { p: Pt; r: number }[] = [];
  for (const h of patterns) {
    if (h.boltCircle) pts.push({ p: project(top, v3(h.boltCircle.center)), r: 0.06 });
    else for (const i of h.members) pts.push({ p: project(top, holeFace(top, f.cylinders[i]).center), r: (h.diameter / 2) * top.scale });
  }
  if (pts.length === 0) return true;
  const { box, scale: s } = top;
  const xs = dedupeValues([0, ...pts.map((q) => (q.p.x - box.x0) / s)]).filter((x) => x < (box.x1 - box.x0) / s - 0.0005);
  const ys = dedupeValues([0, ...pts.map((q) => (q.p.y - box.y0) / s)]).filter((y) => y < (box.y1 - box.y0) / s - 0.0005);
  if (xs.length > MAX_ORDINATES || ys.length > MAX_ORDINATES) return false;
  const px = spreadLabels(xs.map((x) => box.x0 + x * s), ORD_GAP, box.x0 - 0.25, box.x1 + 0.25);
  const py = spreadLabels(ys.map((y) => box.y0 + y * s), ORD_GAP, box.y0 - 0.25, box.y1 + 0.25);
  if (!px || !py) return false;
  const polys = viewPolys(top);
  const gap = DIM.extGap;
  xs.forEach((x, i) => {
    const X = box.x0 + x * s;
    const starts = pts.filter((q) => Math.abs(q.p.x - X) < 1e-4).map((q) => q.p.y + q.r + gap);
    if (x === 0) starts.push((extremeAlong(polys, "x", X, "max") ?? box.y1) + gap);
    ordinateDim(layer, "x-above", pt(X, Math.max(...starts)), box.y1, px[i], fmtOrdinate(x));
  });
  ys.forEach((y, i) => {
    const Y = box.y0 + y * s;
    const starts = pts.filter((q) => Math.abs(q.p.y - Y) < 1e-4).map((q) => q.p.x - q.r - gap);
    if (y === 0) starts.push((extremeAlong(polys, "y", Y, "min") ?? box.x0) - gap);
    ordinateDim(layer, "y", pt(Math.min(...starts), Y), box.x0, py[i], fmtOrdinate(y));
  });
  return true;
}
