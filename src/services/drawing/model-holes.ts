import type { HolePattern, ModelCylinder } from "@/services/dimensions/model-features";
import type { CalloutLine } from "./callouts";
import { DIM } from "./dims";
import { countPrefix, fmtIn } from "./format";
import type { V3 } from "./hlr";
import { v3, type PlacedView } from "./model-views";
import { DEPTH, DIA } from "./text-metrics";

/** Callout text for a single bore pattern: ⌀, THRU or depth, bolt circle. */
export function holeLines(h: HolePattern, cyls: ModelCylinder[]): CalloutLine[] {
  const m = h.members.map((i) => cyls[i]);
  const depths = m.map((c) => c.extent[1] - c.extent[0]);
  const sameDepth = depths.every((d) => Math.abs(d - depths[0]) < 0.001);
  // THRU only when every end is open; a depth only when every hole agrees
  const end = h.thru ? " THRU" : m.every((c) => c.blind) && sameDepth ? ` ${DEPTH}${fmtIn(depths[0])}` : "";
  const lines: CalloutLine[] = [{ text: `${countPrefix(h.stacks.length || h.count)}${DIA}${fmtIn(h.diameter)}${end}`, size: DIM.textH }];
  if (h.boltCircle) lines.push({ text: `EQ SP ON ${DIA}${fmtIn(h.boltCircle.diameter)} B.C.`, size: DIM.textH });
  return lines;
}

/** Hole center at the end facing the viewer, and whether its rim is visible there. */
export function holeFace(pv: PlacedView, c: ModelCylinder): { center: V3; visible: boolean } {
  const a = v3(c.axis), o = v3(c.origin), f = pv.basis.fwd;
  const ends = c.extent.map((t) => [o[0] + a[0] * t, o[1] + a[1] * t, o[2] + a[2] * t] as V3);
  const depth = (p: V3) => p[0] * f[0] + p[1] * f[1] + p[2] * f[2];
  const center = depth(ends[0]) < depth(ends[1]) ? ends[0] : ends[1];
  const u: V3 = Math.abs(a[0]) < 0.9 ? [0, a[2], -a[1]] : [a[1], -a[0], 0];
  const ul = Math.hypot(...u);
  const w: V3 = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  const r = (c.diameter / 2) * 1.08 + 0.005;
  let seen = 0;
  for (let k = 0; k < 8; k++) {
    const cs = (Math.cos((k * Math.PI) / 4) * r) / ul, sn = (Math.sin((k * Math.PI) / 4) * r) / ul;
    if (pv.view.probe([center[0] + u[0] * cs + w[0] * sn, center[1] + u[1] * cs + w[1] * sn, center[2] + u[2] * cs + w[2] * sn])) seen++;
  }
  return { center, visible: seen >= 5 };
}
