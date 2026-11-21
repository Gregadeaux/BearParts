import type { LineView } from "./hlr";
import { STANDARD_SCALES } from "./layout-math";
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
  iso: Box;
  isoScale: number;
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
  let fallback: ModelLayout | null = null;
  for (const s of STANDARD_SCALES) {
    const l = arrange(region, size, iso, showTop, b, s);
    fallback = l;
    if (l && l.isoScale >= Math.min(s, 0.25)) return l;
  }
  return fallback ?? arrange(region, size, iso, showTop, b, STANDARD_SCALES[STANDARD_SCALES.length - 1], true)!;
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
