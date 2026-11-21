import { DEFAULT_TOLERANCE_IN, HOLE_TOLERANCE_IN } from "@/services/dimensions/key-dimensions";
import { recognizeModelFeatures, type ModelFeatures } from "@/services/dimensions/model-features";
import { Layer } from "./canvas";
import { CalloutPlacer } from "./callouts";
import { DIM, linearDim, ordinateBand } from "./dims";
import { extremeAlong } from "./dxf-view";
import { fmtIn, fmtScale } from "./format";
import { lineView, VIEWS } from "./hlr";
import { buildTopology } from "./mesh-topology";
import { layoutViews, type Bands } from "./model-layout";
import { calloutHoles, holeFace, locateInTop } from "./model-holes";
import { drawingFrame, rotatePositions, viewPolys, viewsMatch, type PlacedView } from "./model-views";
import { isComplete } from "./model-complete";
import { meshNotes, titleFields, type DrawingMeta } from "./notes";
import { polyline, pt, text, type Pt, type Sheet } from "./primitives";
import { drawFrame, frameRegion, SHEET_H, SHEET_W } from "./sheet-frame";
import { coaxial, dimensionTurned } from "./turned-dims";
import type { Box } from "./text-metrics";

const LABEL_H = 0.1;

export interface ModelSheetResult {
  sheet: Sheet;
  scale: number;
  isoScale: number;
  /** overall size, inches, in the drawing's orientation */
  size: { x: number; y: number; z: number };
  features: ModelFeatures | null;
  views: ("front" | "top" | "right" | "iso")[];
  /** every recognized feature dimensioned and nothing unrecognized */
  complete: boolean;
}

/**
 * Multi-view sheet for a 3D model (inches, Z up). Third-angle FRONT / TOP /
 * RIGHT + ISOMETRIC with hidden lines removed. With B-rep face ids (STEP),
 * features are recognized: turned parts are drawn axis-horizontal with
 * diameters, shoulders and grooves; holes get callouts in the view down
 * their axis. A TOP identical to FRONT is dropped.
 */
export function buildModelSheet(
  rawPositions: ArrayLike<number>,
  meta: DrawingMeta,
  faceIds: ArrayLike<number> | null = null,
): ModelSheetResult {
  let positions: ArrayLike<number> = rawPositions;
  let features = faceIds ? recognizeModelFeatures(positions, faceIds) : null;
  const frame = features && drawingFrame(features);
  if (frame && faceIds) {
    positions = rotatePositions(positions, frame);
    features = recognizeModelFeatures(positions, faceIds);
  }
  const turned = features?.turned ?? null;
  const topo = buildTopology(positions, 30, faceIds);
  const views = {
    front: lineView(topo, VIEWS.front),
    top: lineView(topo, VIEWS.top),
    right: lineView(topo, VIEWS.right),
    iso: lineView(topo, VIEWS.iso),
  };
  // a TOP that draws exactly like FRONT (turned parts) adds nothing
  const showTop = !viewsMatch(views.front, views.top);
  const size = {
    x: views.front.maxU - views.front.minU,
    y: views.top.maxV - views.top.minV,
    z: views.front.maxV - views.front.minV,
  };

  const holeCount = features?.holes.length ?? 0;
  const ordBand = ordinateBand(0.5);
  const bands: Bands = turned
    ? { left: 0.95, bottom: ordBand + 0.35, top: 1.2, gapSide: 1.3, gapTop: 0.55, topLeft: 0, topTop: 0, calloutRoom: 1.4 }
    : {
        left: 0.85, bottom: 0.85, top: 0.3, gapSide: 0.75, gapTop: 0.55,
        topLeft: holeCount ? ordBand : 0, topTop: holeCount ? ordBand : 0.1, calloutRoom: holeCount ? 1.2 : 0.4,
      };

  // the note is decided after dimensioning; reserve its lines up front
  const notes = meshNotes(meta, true);
  const region = frameRegion(notes);
  const L = layoutViews(region, size, views.iso, showTop, bands);
  const s = L.scale;

  const layer = new Layer();
  const placed: PlacedView[] = [
    { key: "front", basis: VIEWS.front, view: views.front, box: L.front, scale: s },
    { key: "right", basis: VIEWS.right, view: views.right, box: L.right, scale: s },
  ];
  if (L.top) placed.push({ key: "top", basis: VIEWS.top, view: views.top, box: L.top, scale: s });
  const isoW = (views.iso.maxU - views.iso.minU) * L.isoScale;
  const isoH = (views.iso.maxV - views.iso.minV) * L.isoScale;
  const isoBox = { x0: (L.iso.x0 + L.iso.x1 - isoW) / 2, y0: (L.iso.y0 + L.iso.y1 - isoH) / 2 + 0.15, x1: 0, y1: 0 };
  placed.push({ key: "iso", basis: VIEWS.iso, view: views.iso, box: { ...isoBox, x1: isoBox.x0 + isoW, y1: isoBox.y0 + isoH }, scale: L.isoScale });
  for (const pv of placed) drawView(layer, pv);

  const get = (k: string) => placed.find((p) => p.key === k)!;
  const front = get("front"), right = get("right"), top = L.top ? get("top") : null, iso = get("iso");
  // labels first so dimensions route around them
  const labelY = L.front.y0 - (turned ? ordBand + 0.12 : DIM.offset + 0.32);
  label(layer, "FRONT", (L.front.x0 + L.front.x1) / 2, labelY);
  label(layer, "RIGHT", (L.right.x0 + L.right.x1) / 2, L.right.y0 - (turned ? 0.25 : DIM.offset + 0.32));
  if (top) label(layer, "TOP", (top.box.x0 + top.box.x1) / 2, top.box.y0 - 0.22);
  label(layer, "ISOMETRIC", (iso.box.x0 + iso.box.x1) / 2, iso.box.y0 - 0.22);
  layer.text(text("NOT TO SCALE", pt((iso.box.x0 + iso.box.x1) / 2, iso.box.y0 - 0.38), 0.08, { align: "center", valign: "top" }));

  const viewOutlines = placed.map((p) => boxPoly(p.box));
  const placer = new CalloutPlacer(layer, region, [], viewOutlines);
  let dimensioned = true;
  if (turned && features) {
    dimensioned = dimensionTurned(layer, placer, turned, features, front, right);
    const called = calloutHoles(layer, placer, features, placed, (h) => h.count === 1 && coaxial(features!.cylinders[h.members[0]].origin, turned.origin));
    dimensioned &&= features.holes.every((h) => called.has(h) || (h.count === 1 && coaxial(features!.cylinders[h.members[0]].origin, turned.origin)));
    dimensioned &&= features.holes.every((h) => h.boltCircle || (h.count === 1 && coaxial(features!.cylinders[h.members[0]].origin, turned.origin)));
  } else {
    overallDims(layer, front, right, size);
    if (features) {
      // locate first (fixed positions), then fit callouts around the ordinates
      const inTop = top ? features.holes.filter((h) => Math.abs(h.axis.z) > 0.999 && h.members.every((i) => holeFace(top, features!.cylinders[i]).visible)) : [];
      const located = top ? locateInTop(layer, top, features, inTop) : false;
      const called = calloutHoles(layer, placer, features, placed, () => false);
      dimensioned = called.size === features.holes.length && (features.holes.length === 0 || (located && inTop.length === called.size));
    }
  }
  const bounds = {
    min: [views.front.minU, views.top.minV, views.front.minV] as [number, number, number],
    max: [views.front.maxU, views.top.maxV, views.front.maxV] as [number, number, number],
  };
  const complete = Boolean(features) && dimensioned && isComplete(features!, bounds);

  drawFrame(
    layer,
    { ...titleFields(meta), scale: fmtScale(s), toleranceIn: DEFAULT_TOLERANCE_IN, holeToleranceIn: HOLE_TOLERANCE_IN, thirdAngle: true },
    meshNotes(meta, !complete),
  );
  return {
    sheet: { width: SHEET_W, height: SHEET_H, shapes: layer.shapes },
    scale: s,
    isoScale: L.isoScale,
    size,
    features,
    views: placed.map((p) => p.key),
    complete,
  };
}

/** Overall length + height on FRONT, depth on RIGHT (non-turned parts). */
function overallDims(layer: Layer, front: PlacedView, right: PlacedView, size: { x: number; y: number; z: number }) {
  const fp = viewPolys(front), rp = viewPolys(right);
  const f = front.box, r = right.box;
  const low = (p: Pt[][], x: number, fb: number) => extremeAlong(p, "x", x, "min") ?? fb;
  const lft = (p: Pt[][], y: number, fb: number) => extremeAlong(p, "y", y, "min") ?? fb;
  linearDim(layer, pt(f.x0, low(fp, f.x0, f.y0)), pt(f.x1, low(fp, f.x1, f.y0)), "h", f.y0 - DIM.offset, fmtIn(size.x));
  linearDim(layer, pt(lft(fp, f.y0, f.x0), f.y0), pt(lft(fp, f.y1, f.x0), f.y1), "v", f.x0 - DIM.offset, fmtIn(size.z));
  linearDim(layer, pt(r.x0, low(rp, r.x0, r.y0)), pt(r.x1, low(rp, r.x1, r.y0)), "h", r.y0 - DIM.offset, fmtIn(size.y));
}

/** Draw a view's visible edges (thick, and obstacles for annotations). */
function drawView(layer: Layer, pv: PlacedView) {
  for (const [a, b] of viewPolys(pv)) layer.path(polyline([a, b], false, "thick"));
}

const boxPoly = (b: Box): Pt[] => [pt(b.x0, b.y0), pt(b.x1, b.y0), pt(b.x1, b.y1), pt(b.x0, b.y1)];

function label(layer: Layer, s: string, x: number, y: number) {
  layer.text(text(s, pt(x, y), LABEL_H, { align: "center", valign: "top", bold: true }));
}
