import type { DxfAnalysis } from "@/types/analysis";
import type { NormalizedEntity } from "@/types/geometry";
import { DEFAULT_TOLERANCE_IN, HOLE_TOLERANCE_IN } from "@/services/dimensions/key-dimensions";
import { Layer } from "./canvas";
import { CalloutPlacer, circleAnchors, placeTag, type CalloutLine, type LeaderAnchor } from "./callouts";
import { centerMark, DIM } from "./dims";
import { drawOrdinates, drawOverallDims, overallAsOrdinates } from "./dxf-dims";
import { extractFeatures, type RadiusFeature } from "./dxf-features";
import { planDxf, type DxfPlan } from "./dxf-plan";
import { drawEntities, modelOutline, toPaper, type ViewXform } from "./dxf-view";
import { countPrefix, fmtIn, fmtScale } from "./format";
import { drawHoleTable, tagHoles } from "./hole-table";
import { dxfNotes, holeMatchText, titleFields, type DrawingMeta } from "./notes";
import { sub, unit, mul, type Sheet } from "./primitives";
import { drawFrame, SHEET_H, SHEET_W } from "./sheet-frame";
import { DIA } from "./text-metrics";

export interface DxfSheetResult {
  sheet: Sheet;
  plan: DxfPlan;
  /** callouts that found no clean spot (drawn anyway with overlap) */
  crowded: number;
}

/** Lay out the single flat-profile view of a DXF part. Pure. */
export function buildDxfSheet(entities: NormalizedEntity[], analysis: DxfAnalysis, meta: DrawingMeta): DxfSheetResult {
  const bbox = analysis.boundingBox;
  const features = extractFeatures(entities, analysis);
  const radiusGroups = groupRadii(features.radii);
  const holeGroups = groupHoles(features.holes);
  const tableLegend = holeGroups.map((g, i) => {
    const m = holeMatchText(g.matches);
    return m ? `${String.fromCharCode(65 + i)}: ${m}` : null;
  }).filter((s): s is string => s !== null);

  const farEdge = features.outerCircle ? { x: false, y: false } : overallAsOrdinates(modelOutline(entities), bbox);
  // a bore concentric with a round part is located by its center lines alone
  const oc = features.outerCircle;
  const located = oc
    ? features.holes.filter((h) => Math.hypot(h.center.x - oc.center.x, h.center.y - oc.center.y) > 1e-3)
    : features.holes;
  const plan = planDxf({
    bbox,
    holes: located,
    points: features.points,
    notesFor: (profileDimensioned) =>
      dxfNotes(meta, features.freeform || (!profileDimensioned && hasInteriorPoints(features.points, bbox))),
    hasCallouts: features.holes.length + radiusGroups.length > 0 || features.outerCircle !== null,
    tableLegendLines: tableLegend.length,
    farEdge,
    qr: Boolean(meta.url),
  });

  const layer = new Layer();
  drawFrame(
    layer,
    {
      ...titleFields(meta),
      scale: fmtScale(plan.scale),
      toleranceIn: DEFAULT_TOLERANCE_IN,
      holeToleranceIn: HOLE_TOLERANCE_IN,
      thirdAngle: false,
    },
    plan.notes,
  );

  const { region, bands, scale } = plan;
  const W = bbox.width * scale;
  const H = bbox.height * scale;
  const blockW = bands.left + W + bands.right;
  const blockH = bands.bottom + H + bands.top;
  const v: ViewXform = {
    ox: region.x0 + Math.max(0, (region.x1 - region.x0 - blockW) / 2) + bands.left,
    oy: region.y0 + Math.max(0, (region.y1 - region.y0 - blockH) / 2) + bands.bottom,
    scale,
    minX: bbox.min.x,
    minY: bbox.min.y,
  };

  const polys = drawEntities(layer, entities, v);
  for (const h of features.holes) centerMark(layer, toPaper(v, h.center), (h.diameter / 2) * scale);
  if (oc) centerMark(layer, toPaper(v, oc.center), (oc.diameter / 2) * scale);
  // slot ends and other located arcs get center marks so their ordinates have an origin
  for (const p of features.points) if (p.kind === "arc-center") centerMark(layer, toPaper(v, p), 0);
  if (!oc) drawOverallDims(layer, polys, v, bbox, { width: !farEdge.x, height: !farEdge.y });
  drawOrdinates(layer, plan, polys, v, located, features.points);

  const bandsSoft = [
    { x0: v.ox - bands.left, y0: v.oy - bands.bottom, x1: v.ox + W + 0.25, y1: v.oy },
    { x0: v.ox - bands.left, y0: v.oy - bands.bottom, x1: v.ox, y1: v.oy + H + 0.25 },
  ];
  const outline = features.outline?.map((p) => toPaper(v, p));
  const callouts = new CalloutPlacer(layer, region, bandsSoft, outline ? [outline] : []);
  let crowded = 0;
  const callout = (lines: CalloutLine[], anchors: LeaderAnchor[]) => {
    if (!callouts.place(lines, anchors)) crowded++;
  };

  if (features.outerCircle) {
    const c = features.outerCircle;
    callout([{ text: `${DIA}${fmtIn(c.diameter)}`, size: DIM.textH }], circleAnchors(toPaper(v, c.center), (c.diameter / 2) * scale));
  }

  if (plan.holeMode === "table" && plan.table) {
    const rows = tagHoles(features.holes, bbox.min.x, bbox.min.y);
    drawHoleTable(layer, rows, SHEET_W - 0.475, SHEET_H - 0.475, plan.table.rowsPerSet, tableLegend);
    for (const r of rows) placeTag(layer, region, toPaper(v, r.hole.center), (r.hole.diameter / 2) * scale, r.tag, DIM.smallH);
  } else {
    // biggest features first — they have the most room around them
    for (const g of [...holeGroups].sort((a, b) => b.diameter - a.diameter)) {
      const lines: CalloutLine[] = [{ text: `${countPrefix(g.holes.length)}${DIA}${fmtIn(g.diameter)} THRU`, size: DIM.textH }];
      const match = holeMatchText(g.matches);
      if (match) lines.push({ text: `(${match})`, size: DIM.smallH });
      callout(lines, g.holes.flatMap((h) => circleAnchors(toPaper(v, h.center), (h.diameter / 2) * scale)));
    }
  }

  for (const g of radiusGroups) {
    const anchors = g.arcs.flatMap((a) => {
      const tip = toPaper(v, a.mid);
      const out = unit(sub(tip, toPaper(v, a.center)));
      return [{ tip, dir: out }, { tip, dir: mul(out, -1) }];
    });
    callout([{ text: `${countPrefix(g.arcs.length)}R${fmtIn(g.radius)}`, size: DIM.textH }], anchors);
  }

  return { sheet: { width: SHEET_W, height: SHEET_H, shapes: layer.shapes }, plan, crowded };
}

function groupHoles(holes: DxfAnalysis["holes"]) {
  const map = new Map<string, { diameter: number; holes: DxfAnalysis["holes"]; matches: DxfAnalysis["holes"][number]["matches"] }>();
  for (const h of [...holes].sort((a, b) => a.diameter - b.diameter)) {
    const key = h.diameter.toFixed(3);
    const g = map.get(key);
    if (g) g.holes.push(h);
    else map.set(key, { diameter: h.diameter, holes: [h], matches: h.matches });
  }
  return [...map.values()];
}

function groupRadii(radii: RadiusFeature[]) {
  const map = new Map<string, { radius: number; arcs: RadiusFeature[] }>();
  for (const r of radii) {
    const key = r.radius.toFixed(3);
    const g = map.get(key);
    if (g) g.arcs.push(r);
    else map.set(key, { radius: r.radius, arcs: [r] });
  }
  return [...map.values()].sort((a, b) => b.radius - a.radius);
}

/** Any contour point that isn't on the bounding box (so needs its own ordinate)? */
function hasInteriorPoints(points: { x: number; y: number }[], bbox: DxfAnalysis["boundingBox"]): boolean {
  const on = (v: number, lo: number, hi: number) => Math.abs(v - lo) < 0.0005 || Math.abs(v - hi) < 0.0005;
  return points.some((p) => !on(p.x, bbox.min.x, bbox.max.x) || !on(p.y, bbox.min.y, bbox.max.y));
}
