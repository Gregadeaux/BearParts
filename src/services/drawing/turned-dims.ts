import type { ModelFeatures, TurnedProfile } from "@/services/dimensions/model-features";
import type { Layer } from "./canvas";
import { CalloutPlacer, circleAnchors } from "./callouts";
import { arrowhead, centerDashes, centerMark, DIM, linearDim, ordinateDim } from "./dims";
import { ORD_GAP } from "./dxf-plan";
import { extremeAlong } from "./dxf-view";
import { fmtIn, fmtOrdinate } from "./format";
import { dedupeValues, spreadLabels } from "./layout-math";
import { holeFace, holeLines } from "./model-holes";
import { project, v3, viewPolys, type PlacedView } from "./model-views";
import { line, pt } from "./primitives";
import { DIA } from "./text-metrics";

/**
 * Dimension a turned part drawn with its axis along model X: FRONT gets the
 * axis center line, overall length (top), shoulder/groove-wall positions as
 * ordinates from the left end face (bottom) and each distinct outside
 * diameter once; RIGHT (the circle view) gets the coaxial bores.
 * Returns whether every coaxial feature got its dimension.
 */
export function dimensionTurned(
  layer: Layer,
  placer: CalloutPlacer,
  t: TurnedProfile,
  f: ModelFeatures,
  front: PlacedView,
  right: PlacedView,
): boolean {
  const s = front.scale;
  const o = v3(t.origin);
  const axisY = project(front, [0, o[1], o[2]]).y;
  const { x0, x1, y0, y1 } = front.box;
  const polys = viewPolys(front);
  let complete = true;

  // axis center line, 1/8" past both ends
  const cl0 = x0 - 0.125;
  for (const [a, b] of centerDashes(0, x1 + 0.125 - cl0)) layer.path(line(pt(cl0 + a, axisY), pt(cl0 + b, axisY)), false);

  // overall length above the view
  const L = t.extent[1] - t.extent[0];
  const topAt = (x: number) => extremeAlong(polys, "x", x, "max") ?? y1;
  linearDim(layer, pt(x0, topAt(x0)), pt(x1, topAt(x1)), "h", y1 + DIM.offset, fmtIn(L));

  // shoulders & groove walls: ordinates from the left end face
  const xs = dedupeValues([0, ...t.shoulders.map((p) => p - t.extent[0])]).filter((x) => x < L - 0.0005);
  if (xs.length > 1) {
    const desired = xs.map((x) => x0 + x * s);
    const placed = spreadLabels(desired, ORD_GAP, x0 - 0.25, x1 + 0.25) ?? desired;
    xs.forEach((x, i) => {
      const low = extremeAlong(polys, "x", desired[i], "min") ?? y0;
      ordinateDim(layer, "x", pt(desired[i], low - DIM.extGap), y0, placed[i], fmtOrdinate(x));
    });
  }

  // each distinct OD once, on its longest step: dimension line inside the
  // step (arrows out to the silhouettes), value on a leader above
  const byDia = new Map<string, TurnedProfile["steps"][number]>();
  for (const st of t.steps) {
    const k = st.diameter.toFixed(3);
    const cur = byDia.get(k);
    if (!cur || st.end - st.start > cur.end - cur.start) byDia.set(k, st);
  }
  const first = t.steps[0], last = t.steps[t.steps.length - 1];
  const endGap = 0.1 * L; // a chamfer/edge break may sit past the end step
  for (const st of [...byDia.values()].sort((a, b) => b.diameter - a.diameter)) {
    const r = (st.diameter / 2) * s;
    const label = `${DIA}${fmtIn(st.diameter)}`;
    // an end step at least as big as its neighbor: plain linear ⌀ beside the view
    const neighbor = (st === first ? t.steps[1] : st === last ? t.steps[t.steps.length - 2] : null)?.diameter ?? 0;
    const atStart = st === first && st.start - t.extent[0] < endGap && st.diameter >= neighbor;
    const atEnd = st === last && t.extent[1] - st.end < endGap && st.diameter >= neighbor;
    if (atStart || atEnd) {
      const ex = x0 + ((atStart ? st.start : st.end) - t.extent[0]) * s;
      const at = atStart ? x0 - DIM.offset : x1 + DIM.offset;
      // value off-center so the axis center line doesn't run through it
      linearDim(layer, pt(ex, axisY - r), pt(ex, axisY + r), "v", at, label, 0.72);
      continue;
    }
    // the dimension line may sit anywhere along the step; try a few spots
    const anchors = [0.5, 0.3, 0.7, 0.15, 0.85].flatMap((k) => {
      const x = x0 + (st.start + (st.end - st.start) * k - t.extent[0]) * s;
      const top = pt(x, axisY + r), bottom = pt(x, axisY - r);
      return [
        { tip: top, dir: pt(0, 1) },
        { tip: top, dir: pt(-1e-6, 1) },
        { tip: bottom, dir: pt(0, -1) },
        { tip: bottom, dir: pt(-1e-6, -1) },
      ];
    });
    const won = placer.placeAt([{ text: label, size: DIM.textH }], anchors, false);
    if (!won) {
      complete = false;
      continue;
    }
    const top = pt(won.tip.x, axisY + r), bottom = pt(won.tip.x, axisY - r);
    layer.path(line(bottom, top));
    arrowhead(layer, top, pt(0, 1));
    arrowhead(layer, bottom, pt(0, -1));
  }

  // circle view: center mark across the largest OD, then coaxial bores
  const c = project(right, o);
  const maxR = Math.max(...t.steps.map((st) => st.diameter / 2)) * right.scale;
  centerMark(layer, c, maxR);
  for (const h of f.holes) {
    const cyl = f.cylinders[h.members[0]];
    if (h.count !== 1 || !coaxial(cyl.origin, t.origin)) continue;
    const face = holeFace(right, cyl);
    const ok = face.visible && placer.place(holeLines(h, f.cylinders), circleAnchors(c, (h.diameter / 2) * right.scale));
    if (!ok) complete = false;
  }
  return complete;
}

/** Same axis line (after orientation the turned axis is parallel to X). */
export function coaxial(a: { y: number; z: number }, b: { y: number; z: number }): boolean {
  return Math.hypot(a.y - b.y, a.z - b.z) < 1e-3;
}
