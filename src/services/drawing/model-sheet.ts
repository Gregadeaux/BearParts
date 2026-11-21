import { DEFAULT_TOLERANCE_IN, HOLE_TOLERANCE_IN } from "@/services/dimensions/key-dimensions";
import { recognizeModelFeatures, type ModelFeatures } from "@/services/dimensions/model-features";
import { Layer } from "./canvas";
import { CalloutPlacer } from "./callouts";
import { DIM, ordinateBand } from "./dims";
import { extremeAlong } from "./dxf-view";
import { countPrefix, fmtIn, fmtScale } from "./format";
import { edgeText } from "./hole-grid";
import { lineView, VIEWS } from "./hlr";
import { buildTopology } from "./mesh-topology";
import { isComplete } from "./model-complete";
import { calloutViewHoles, DimLevels, drawViewHoles, placeSideDim, type Side } from "./model-hole-dims";
import { planViewHoles, type ViewHolePlan, type ViewName } from "./model-hole-plan";
import { layoutViews, sheetBands } from "./model-layout";
import { rectTube } from "./model-tube";
import { drawingFrame, project, rotatePositions, viewPolys, viewsMatch, type PlacedView } from "./model-views";
import { meshNotes, titleFields, type DrawingMeta } from "./notes";
import { polyline, pt, text, type Pt, type Sheet } from "./primitives";
import { drawFrame, frameRegion, SHEET_H, SHEET_W } from "./sheet-frame";
import { DIA, type Box } from "./text-metrics";
import { coaxial, dimensionTurned } from "./turned-dims";

export interface ModelSheetResult {
  sheet: Sheet;
  scale: number;
  isoScale: number;
  /** overall size, inches, in the drawing's orientation */
  size: { x: number; y: number; z: number };
  features: ModelFeatures | null;
  views: ("front" | "top" | "right" | "iso")[];
  /** per-view hole plans (what was dimensioned where) */
  holePlans: ViewHolePlan[];
  /** uniform tube wall, when the part is a rectangular tube */
  wall: number | null;
  /** every recognized feature dimensioned and nothing unrecognized */
  complete: boolean;
}

/** Where each view's hole dimensions go: (u = horizontal, v = vertical). */
const SIDES: Record<ViewName, { u: Side; v: Side }> = {
  front: { u: "below", v: "left" },
  top: { u: "above", v: "left" },
  right: { u: "below", v: "right" },
};

/**
 * Multi-view sheet for a 3D model (inches). Third-angle FRONT / TOP / RIGHT
 * (+ ISOMETRIC when it fits) with hidden lines removed, oriented long axis
 * horizontal (turned parts axis-horizontal). With B-rep face ids (STEP),
 * features are dimensioned: turned profiles, hole callouts per view, hole
 * grids by edge distance + pitch, tube wall thickness.
 */
export function buildModelSheet(rawPositions: ArrayLike<number>, meta: DrawingMeta, faceIds: ArrayLike<number> | null = null): ModelSheetResult {
  let positions: ArrayLike<number> = rawPositions;
  let features = faceIds ? recognizeModelFeatures(positions, faceIds) : null;
  const frame = drawingFrame(features, positions);
  if (frame) {
    positions = rotatePositions(positions, frame);
    if (faceIds) features = recognizeModelFeatures(positions, faceIds);
  }
  const turned = features?.turned ?? null;
  const topo = buildTopology(positions, 30, faceIds);
  const views = { front: lineView(topo, VIEWS.front), top: lineView(topo, VIEWS.top), right: lineView(topo, VIEWS.right), iso: lineView(topo, VIEWS.iso) };
  // drop a TOP that draws like FRONT — unless holes are seen only from the top
  const topHoles = Boolean(features?.stacks.some((st) => Math.abs(st.axis.z) > 0.999));
  const showTop = topHoles || !viewsMatch(views.front, views.top);
  const size = { x: views.front.maxU - views.front.minU, y: views.top.maxV - views.top.minV, z: views.front.maxV - views.front.minV };
  const bounds = {
    min: [views.front.minU, views.top.minV, views.front.minV] as [number, number, number],
    max: [views.front.maxU, views.top.maxV, views.front.maxV] as [number, number, number],
  };
  const tube = features && !turned ? rectTube(features, bounds.min, bounds.max) : null;

  // hole plans first — the bands around each view depend on them
  const ortho = (["front", "top", "right"] as ViewName[])
    .filter((n) => n !== "top" || showTop)
    .filter((n) => !turned || n === "right")
    .map((name) => ({ name, basis: VIEWS[name], view: views[name] }));
  let plans = features ? planViewHoles(features, ortho) : [];
  if (turned && features) {
    // coaxial bores are dimensioned with the turned profile; others need a bolt circle
    plans = plans
      .map((p) => ({ ...p, holes: p.holes.filter((h) => !coaxial(features!.stacks[h.stack].center, turned.origin)), dims: [], ordinates: false }))
      .map((p) => ({ ...p, callouts: p.callouts.map((c) => ({ ...c, holes: c.holes.filter((h) => p.holes.includes(h)) })).filter((c) => c.holes.length) }))
      .map((p) => ({ ...p, unlocated: p.holes.some((h) => !features!.holes.find((pat) => pat.stacks.includes(h.stack))?.boltCircle) }));
  }
  const shown = new Set(plans.flatMap((p) => p.holes.map((h) => h.stack)));
  const hiddenNotes = features ? notShownNotes(features, shown, turned ? (k) => coaxial(features!.stacks[k].center, turned.origin) : () => false) : [];

  const notes = [...meshNotes(meta, true), ...hiddenNotes];
  const region = frameRegion(notes, Boolean(meta.url));
  const L = layoutViews(region, size, views.iso, showTop, sheetBands(plans, Boolean(turned), Boolean(tube)));
  const s = L.scale;

  const layer = new Layer();
  const placed: PlacedView[] = [
    { key: "front", basis: VIEWS.front, view: views.front, box: L.front, scale: s },
    { key: "right", basis: VIEWS.right, view: views.right, box: L.right, scale: s },
  ];
  if (L.top) placed.push({ key: "top", basis: VIEWS.top, view: views.top, box: L.top, scale: s });
  if (L.iso) {
    const w = (views.iso.maxU - views.iso.minU) * L.isoScale, h = (views.iso.maxV - views.iso.minV) * L.isoScale;
    const x0 = (L.iso.x0 + L.iso.x1 - w) / 2, y0 = (L.iso.y0 + L.iso.y1 - h) / 2 + 0.15;
    placed.push({ key: "iso", basis: VIEWS.iso, view: views.iso, box: { x0, y0, x1: x0 + w, y1: y0 + h }, scale: L.isoScale });
  }
  for (const pv of placed) for (const [a, b] of viewPolys(pv)) layer.path(polyline([a, b], false, "thick"));
  const get = (k: string) => placed.find((p) => p.key === k);
  const front = get("front")!, right = get("right")!, top = get("top"), iso = get("iso");

  const levels = new DimLevels();
  let dimensioned = true;
  if (turned && features) dimensioned = dimensionTurned(layer, new CalloutPlacer(layer, region), turned, features, front, right);
  // pattern rows nearest the views, overall sizes stacked outside them (ASME: smaller inside)
  for (const plan of plans) {
    const pv = get(plan.view);
    if (pv && features) dimensioned = drawViewHoles(layer, region, levels, pv, plan, features, SIDES[plan.view]) && dimensioned;
  }
  if (!turned) dimensioned = overallDims(layer, region, levels, front, right, size, plans) && dimensioned;
  // labels go under the finished dimension stacks, before callouts look for room
  labels(layer, levels, plans, front, right, top, iso, Boolean(turned));
  // fixed dimensions are down; callouts route around them
  const placer = new CalloutPlacer(layer, region, [], placed.map((p) => boxPoly(p.box)));
  for (const plan of plans) {
    const pv = get(plan.view);
    if (pv) dimensioned = calloutViewHoles(placer, pv, plan) && dimensioned;
  }
  if (tube) dimensioned = placer.place([{ text: `${edgeText(tube.wall)[0]} WALL`, size: DIM.textH }], wallAnchors(right, tube.wall)) && dimensioned;
  const complete = Boolean(features) && dimensioned && hiddenNotes.length === 0 && isComplete(features!, bounds, tube?.inner ?? []);
  drawFrame(
    layer,
    { ...titleFields(meta), scale: fmtScale(s), toleranceIn: DEFAULT_TOLERANCE_IN, holeToleranceIn: HOLE_TOLERANCE_IN, thirdAngle: true },
    [...meshNotes(meta, !complete), ...hiddenNotes],
  );
  return {
    sheet: { width: SHEET_W, height: SHEET_H, shapes: layer.shapes },
    scale: s, isoScale: L.isoScale, size, features, views: placed.map((p) => p.key), holePlans: plans, wall: tube?.wall ?? null, complete,
  };
}

/** Holes no view shows (hidden everywhere): still state diameter and count. */
function notShownNotes(f: ModelFeatures, shown: Set<number>, skip: (k: number) => boolean): string[] {
  const byDia = new Map<string, number>();
  f.stacks.forEach((st, k) => {
    if (shown.has(k) || skip(k)) return;
    const key = fmtIn(st.diameter);
    byDia.set(key, (byDia.get(key) ?? 0) + 1);
  });
  return [...byDia].map(([d, n]) => `${countPrefix(n)}${DIA}${d} HOLE${n > 1 ? "S" : ""} NOT SHOWN IN ANY VIEW; LOCATE PER CAD MODEL.`);
}

/** Overall length + height on FRONT, depth on RIGHT, outside the planned pattern rows. */
function overallDims(
  layer: Layer, region: Box, levels: DimLevels, front: PlacedView, right: PlacedView,
  size: { x: number; y: number; z: number }, plans: ViewHolePlan[],
): boolean {
  const fp = viewPolys(front), rp = viewPolys(right);
  const f = front.box, r = right.box;
  const low = (p: Pt[][], x: number, fb: number) => extremeAlong(p, "x", x, "min") ?? fb;
  const lft = (p: Pt[][], y: number, fb: number) => extremeAlong(p, "y", y, "min") ?? fb;
  // vertical value: break the line midway between hole rows, never on one
  const rowYs = [...new Set((plans.find((p) => p.view === "front")?.holes ?? []).map((h) => +project(front, h.center).y.toFixed(4)))].sort((a, b) => a - b);
  const stops = [f.y0, ...rowYs, f.y1];
  const mids = stops.slice(1).map((y, i) => ({ frac: ((y + stops[i]) / 2 - f.y0) / (f.y1 - f.y0), room: y - stops[i] }));
  const fracs = rowYs.length
    ? mids.filter((m) => m.room > DIM.textH + 0.06).sort((a, b) => Math.abs(a.frac - 0.5) - Math.abs(b.frac - 0.5)).map((m) => m.frac)
    : [0.5, 0.3, 0.7];
  // a view located by ordinates already gives its overall sizes as far-edge ordinates
  const byOrdinates = (view: string) => Boolean(plans.find((p) => p.view === view)?.ordinates);
  return [
    byOrdinates("front") || placeSideDim(layer, region, levels, front, "below", pt(f.x0, low(fp, f.x0, f.y0)), pt(f.x1, low(fp, f.x1, f.y0)), [fmtIn(size.x)]),
    byOrdinates("front") || placeSideDim(layer, region, levels, front, "left", pt(lft(fp, f.y0, f.x0), f.y0), pt(lft(fp, f.y1, f.x0), f.y1), [fmtIn(size.z)], undefined, fracs),
    byOrdinates("right") || placeSideDim(layer, region, levels, right, "below", pt(r.x0, low(rp, r.x0, r.y0)), pt(r.x1, low(rp, r.x1, r.y0)), [fmtIn(size.y)]),
  ].every(Boolean);
}

/** Leader anchors on the top wall of the end view (RIGHT). */
function wallAnchors(right: PlacedView, wall: number) {
  const { box, scale } = right;
  const y = box.y1 - (wall * scale) / 2;
  return [0.5, 0.25, 0.75].flatMap((k) => {
    const tip = pt(box.x0 + (box.x1 - box.x0) * k, box.y1);
    return [{ tip, dir: pt(0.6, 0.8) }, { tip, dir: pt(-0.6, 0.8) }, { tip: pt(box.x1, y), dir: pt(0.8, 0.6) }];
  });
}

const boxPoly = (b: Box): Pt[] => [pt(b.x0, b.y0), pt(b.x1, b.y0), pt(b.x1, b.y1), pt(b.x0, b.y1)];

function labels(
  layer: Layer, levels: DimLevels, plans: ViewHolePlan[], front: PlacedView, right: PlacedView,
  top: PlacedView | undefined, iso: PlacedView | undefined, turned: boolean,
) {
  const label = (s: string, x: number, y: number) => layer.text(text(s, pt(x, y), 0.1, { align: "center", valign: "top", bold: true }));
  // below the outermost dimension row (or ordinate labels) under each view
  const under = (pv: PlacedView) => {
    const reach = levels.extent(pv.key, "below");
    const ords = (turned && pv.key === "front") || plans.some((p) => p.view === pv.key && p.ordinates && SIDES[p.view].u === "below");
    const depth = Math.max(reach > 0 ? reach + 0.08 : 0.15, ords ? ordinateBand(0.5) + 0.12 : 0, turned && pv.key === "right" ? 0.25 : 0);
    return pv.box.y0 - depth;
  };
  label("FRONT", (front.box.x0 + front.box.x1) / 2, under(front));
  label("RIGHT", (right.box.x0 + right.box.x1) / 2, under(right));
  if (top) label("TOP", (top.box.x0 + top.box.x1) / 2, top.box.y0 - 0.12);
  if (iso) {
    label("ISOMETRIC", (iso.box.x0 + iso.box.x1) / 2, iso.box.y0 - 0.22);
    layer.text(text("NOT TO SCALE", pt((iso.box.x0 + iso.box.x1) / 2, iso.box.y0 - 0.38), 0.08, { align: "center", valign: "top" }));
  }
}
