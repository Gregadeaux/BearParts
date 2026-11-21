import { ordinateBand } from "./dims";
import type { LineView } from "./hlr";
import { STANDARD_SCALES } from "./layout-math";
import { levelOffset } from "./model-hole-dims";
import { planRows, type ViewHolePlan } from "./model-hole-plan";
import type { Box } from "./text-metrics";

/** Sheet space (inches) reserved around views for dimensions and callouts. */
export interface Bands {
  /** left of FRONT (height dim) */
  left: number;
  /** below FRONT and RIGHT (length dims / ordinates + view labels) */
  bottom: number;
  /** above FRONT when TOP is not drawn (overall length, ⌀ callouts) */
  top: number;
  /** between FRONT and RIGHT */
  gapSide: number;
  /** between FRONT and TOP (TOP label) */
  gapTop: number;
  /** left of / above TOP (hole ordinates) */
  topLeft: number;
  topTop: number;
  /** right of RIGHT (circle-view callouts) */
  calloutRoom: number;
}

export interface ModelLayout {
  scale: number;
  front: Box;
  top: Box | null;
  right: Box;
  /** null when the isometric was dropped for a larger view scale */
  iso: Box | null;
  isoScale: number;
}

/**
 * Space each side of each view needs: one row per pattern dimension
 * (edge distance, pitch) plus the overall dimension, wider for vertical
 * rows whose horizontal text sits beside the line.
 */
export function sheetBands(plans: ViewHolePlan[], turned: boolean, tube: boolean): Bands {
  if (turned) {
    return { left: 0.95, bottom: ordinateBand(0.5) + 0.35, top: 1.2, gapSide: 1.3, gapTop: 0.55, topLeft: 0, topTop: 0, calloutRoom: 1.4 };
  }
  const rows = (view: string, dir: "u" | "v") => planRows(plans, view, dir);
  const ords = (view: string) => Boolean(plans.find((q) => q.view === view)?.ordinates);
  // vertical rows stack past each other's values (text beside the line)
  const band = (n: number, vertical: boolean, ordinates: boolean) =>
    Math.max(n === 0 ? 0.2 : vertical ? 0.375 + (n - 1) * 0.8 + 0.7 : levelOffset(n - 1) + 0.25, ordinates ? ordinateBand(0.5) : 0);
  const label = 0.35;
  return {
    left: band(rows("front", "v") + 1, true, ords("front")),
    bottom: Math.max(band(rows("front", "u") + 1, false, ords("front")), band(rows("right", "u") + 1, false, ords("right"))) + label,
    top: 0.3,
    gapSide: 0.55,
    gapTop: 0.45,
    topLeft: band(rows("top", "v"), true, ords("top")),
    topTop: band(rows("top", "u"), false, ords("top")),
    calloutRoom: Math.max(band(rows("right", "v"), true, ords("right")), plans.length || tube ? 0.6 : 0.3),
  };
}

/**
 * Third-angle arrangement — TOP above FRONT (optional), RIGHT beside FRONT —
 * at the largest standard scale that fits with its bands, leaving the
 * isometric a usable corner. Sizes are the model's X (FRONT width), Y (TOP
 * height / RIGHT width) and Z (FRONT height).
 */
export function layoutViews(
  region: Box,
  size: { x: number; y: number; z: number },
  iso: LineView,
  showTop: boolean,
  b: Bands,
): ModelLayout {
  // the largest scale whose orthographic views fit wins; the isometric comes
  // along only if it still has a usable corner (legible dimensions matter more)
  for (const s of STANDARD_SCALES) {
    const l = arrange(region, size, iso, showTop, b, s);
    if (!l) continue;
    if (l.isoScale < Math.min(s, 0.25) * 0.8) return { ...l, iso: null, isoScale: 0 };
    return l;
  }
  return arrange(region, size, iso, showTop, b, STANDARD_SCALES[STANDARD_SCALES.length - 1], true)!;
}

function arrange(
  region: Box,
  { x: X, y: Y, z: Z }: { x: number; y: number; z: number },
  iso: LineView,
  showTop: boolean,
  b: Bands,
  s: number,
  force = false,
): ModelLayout | null {
  const W = region.x1 - region.x0;
  const H = region.y1 - region.y0;
  const left = Math.max(b.left, showTop ? b.topLeft : 0);
  const blockW = left + X * s + b.gapSide + Y * s + b.calloutRoom;
  const blockH = b.bottom + Z * s + (showTop ? b.gapTop + Y * s + b.topTop : b.top);
  if (!force && (blockW > W || blockH > H)) return null;
  const x0 = region.x0 + Math.max(0, (W - blockW) / 2) + left;
  const y0 = region.y0 + Math.max(0, (H - blockH) / 2) + b.bottom;
  const front: Box = { x0, y0, x1: x0 + X * s, y1: y0 + Z * s };
  const top: Box | null = showTop ? { x0, y0: front.y1 + b.gapTop, x1: front.x1, y1: front.y1 + b.gapTop + Y * s } : null;
  const right: Box = { x0: front.x1 + b.gapSide, y0, x1: front.x1 + b.gapSide + Y * s, y1: front.y1 };

  // isometric: the free corner above RIGHT, or the column right of it
  const above: Box = {
    x0: Math.max(right.x0, (top?.x1 ?? -Infinity) + 0.6),
    y0: right.y1 + 0.6,
    x1: region.x1 - 0.1,
    y1: region.y1 - 0.1,
  };
  const beside: Box = { x0: right.x1 + 0.6, y0: region.y0 + 0.2, x1: region.x1 - 0.1, y1: region.y1 - 0.1 };
  const fa = isoFit(iso, above);
  const fb = isoFit(iso, beside);
  const box = fa >= fb ? above : beside;
  const isoScale = Math.min(s, Math.max(fa, fb));
  return { scale: s, front, top, right, iso: box, isoScale };
}

/** Largest scale at which the iso view fits the box (with label room). */
function isoFit(iso: LineView, box: Box): number {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0 - 0.45;
  if (w <= 0.3 || h <= 0.3) return 0;
  return Math.min(w / Math.max(iso.maxU - iso.minU, 1e-9), h / Math.max(iso.maxV - iso.minV, 1e-9));
}
