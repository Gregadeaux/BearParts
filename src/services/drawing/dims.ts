import type { Layer } from "./canvas";
import { line, polyline, pt, text, add, mul, sub, unit, type Pt } from "./primitives";
import { textWidth } from "./text-metrics";

/** Drafting sizes on the sheet (inches) â€” ASME Y14.2 / Y14.5 proportions. */
export const DIM = {
  /** dimension values and notes: 0.12" min capitals on A-size (Y14.2) */
  textH: 0.12,
  /** secondary lines (hole-match references) */
  smallH: 0.09,
  /** filled arrowheads, 3:1 */
  arrowL: 0.125,
  arrowW: 0.042,
  /** visible gap between object and extension line */
  extGap: 0.0625,
  /** extension line runs this far past the dimension line */
  extOver: 0.125,
  /** first dimension line from the object */
  offset: 0.375,
  /** clearance around text that breaks a dimension line */
  textGap: 0.05,
  /** leader shoulder (horizontal landing) length */
  shoulder: 0.15,
  /** ordinate jog: run-out before the jog and jog height */
  jogRun: 0.16,
  jogLen: 0.14,
};

/** Filled arrowhead whose tip is at `tip`, pointing along `dir`. */
export function arrowhead(layer: Layer, tip: Pt, dir: Pt) {
  const d = unit(dir);
  const base = sub(tip, mul(d, DIM.arrowL));
  const n = { x: -d.y, y: d.x };
  layer.path(
    polyline([tip, add(base, mul(n, DIM.arrowW / 2)), add(base, mul(n, -DIM.arrowW / 2))], true, "thin", true),
  );
}

/**
 * Linear dimension between feature points a and b, measured along x
 * ("h": dimension line horizontal at y = at) or y ("v": vertical at x = at).
 * Unidirectional text, centered in a break in the dimension line; when the
 * span is too tight, arrows go outside and the text sits beside the line.
 */
export function linearDim(layer: Layer, a: Pt, b: Pt, axis: "h" | "v", at: number, value: string, textFrac = 0.5) {
  const h = DIM.textH;
  const tw = textWidth(value, h);
  if (axis === "h") {
    const [l, r] = a.x <= b.x ? [a, b] : [b, a];
    for (const p of [l, r]) {
      const s = Math.sign(at - p.y) || 1;
      layer.path(line(pt(p.x, p.y + s * DIM.extGap), pt(p.x, at + s * DIM.extOver)));
    }
    const span = r.x - l.x;
    const mid = (l.x + r.x) / 2;
    if (span >= tw + 2 * DIM.arrowL + 2 * DIM.textGap + 0.06) {
      layer.path(line(pt(l.x, at), pt(mid - tw / 2 - DIM.textGap, at)));
      layer.path(line(pt(mid + tw / 2 + DIM.textGap, at), pt(r.x, at)));
      arrowhead(layer, pt(l.x, at), pt(-1, 0));
      arrowhead(layer, pt(r.x, at), pt(1, 0));
      layer.text(text(value, pt(mid, at), h, { align: "center", valign: "middle" }));
    } else {
      const out = DIM.arrowL + 0.12;
      layer.path(line(pt(l.x - out, at), pt(r.x + out, at)));
      arrowhead(layer, pt(l.x, at), pt(1, 0));
      arrowhead(layer, pt(r.x, at), pt(-1, 0));
      // text on the side away from the feature
      const below = at < Math.min(l.y, r.y);
      layer.text(text(value, pt(mid, at + (below ? -DIM.textGap : DIM.textGap)), h, { align: "center", valign: below ? "top" : "bottom" }));
    }
    return;
  }
  const [lo, hi] = a.y <= b.y ? [a, b] : [b, a];
  for (const p of [lo, hi]) {
    const s = Math.sign(at - p.x) || 1;
    layer.path(line(pt(p.x + s * DIM.extGap, p.y), pt(at + s * DIM.extOver, p.y)));
  }
  const span = hi.y - lo.y;
  // where the value breaks the line (0.5 = middle; turned parts move it off the axis)
  const room = h / 2 + DIM.textGap + DIM.arrowL + 0.03;
  const mid = Math.min(Math.max(lo.y + span * textFrac, lo.y + room), hi.y - room);
  if (span >= h + 2 * DIM.arrowL + 2 * DIM.textGap + 0.06) {
    layer.path(line(pt(at, lo.y), pt(at, mid - h / 2 - DIM.textGap)));
    layer.path(line(pt(at, mid + h / 2 + DIM.textGap), pt(at, hi.y)));
    arrowhead(layer, pt(at, lo.y), pt(0, -1));
    arrowhead(layer, pt(at, hi.y), pt(0, 1));
    layer.text(text(value, pt(at, mid), h, { align: "center", valign: "middle" }));
  } else {
    const out = DIM.arrowL + 0.12;
    layer.path(line(pt(at, lo.y - out), pt(at, hi.y + out)));
    arrowhead(layer, pt(at, lo.y), pt(0, 1));
    arrowhead(layer, pt(at, hi.y), pt(0, -1));
    // text on the side away from the feature
    const side = at < Math.min(lo.x, hi.x) ? -1 : 1;
    layer.text(text(value, pt(at + side * (DIM.textGap + tw / 2), mid), h, { align: "center", valign: "middle" }));
  }
}

/**
 * Ordinate dimension. Extension line from `from` (already gapped off the
 * feature) out to the value; `edge` is the profile edge it clears. When the
 * label was spread away from the feature, the line jogs to `labelPos`.
 *  - "x": values below the view, text reading bottom-to-top
 *  - "y": values left of the view, horizontal text
 */
export function ordinateDim(
  layer: Layer,
  axis: "x" | "y" | "x-above",
  from: Pt,
  edge: number,
  labelPos: number,
  value: string,
) {
  const h = DIM.textH;
  if (axis === "x-above") {
    // mirror of "x": values above the view, still reading bottom-to-top
    const x = from.x;
    const yA = edge + DIM.jogRun;
    const yB = yA + DIM.jogLen;
    const yEnd = yB + 0.05;
    const pts = Math.abs(labelPos - x) < 1e-4
      ? [from, pt(x, yEnd)]
      : [from, pt(x, yA), pt(labelPos, yB), pt(labelPos, yEnd)];
    layer.path(polyline(pts, false, "thin"));
    layer.text(text(value, pt(labelPos, yEnd + 0.04), h, { align: "left", valign: "middle", rotate: 90 }));
    return;
  }
  if (axis === "x") {
    const x = from.x;
    const yA = edge - DIM.jogRun;
    const yB = yA - DIM.jogLen;
    const yEnd = yB - 0.05;
    const pts = Math.abs(labelPos - x) < 1e-4
      ? [from, pt(x, yEnd)]
      : [from, pt(x, yA), pt(labelPos, yB), pt(labelPos, yEnd)];
    layer.path(polyline(pts, false, "thin"));
    layer.text(text(value, pt(labelPos, yEnd - 0.04), h, { align: "right", valign: "middle", rotate: 90 }));
    return;
  }
  const y = from.y;
  const xA = edge - DIM.jogRun;
  const xB = xA - DIM.jogLen;
  const xEnd = xB - 0.05;
  const pts = Math.abs(labelPos - y) < 1e-4
    ? [from, pt(xEnd, y)]
    : [from, pt(xA, y), pt(xB, labelPos), pt(xEnd, labelPos)];
  layer.path(polyline(pts, false, "thin"));
  layer.text(text(value, pt(xEnd - 0.04, labelPos), h, { align: "right", valign: "middle" }));
}

/** Space an ordinate run needs beyond the profile edge, for band sizing. */
export function ordinateBand(maxLabelWidth: number): number {
  return DIM.jogRun + DIM.jogLen + 0.09 + maxLabelWidth;
}

/**
 * Center-line dashes between distances `from` and `to` along an arm:
 * long dashes separated by short dash + gaps (Y14.2: long 3/4–1-1/2,
 * short 1/16–1/8, gaps 1/16), always ending on a long dash.
 */
export function centerDashes(from: number, to: number): [number, number][] {
  const LONG = 0.75;
  const SHORT = 0.1;
  const GAP = 0.0625;
  const span = to - from;
  const unit = LONG + 2 * GAP + SHORT;
  if (span <= LONG + 0.25) return [[from, to]];
  // n long dashes, n-1 short ones, stretched evenly to fill the span
  const n = Math.max(2, Math.round((span + 2 * GAP + SHORT) / unit));
  const long = (span - (n - 1) * (2 * GAP + SHORT)) / n;
  const out: [number, number][] = [];
  let t = from;
  for (let i = 0; i < n; i++) {
    out.push([t, t + long]);
    t += long + GAP;
    if (i < n - 1) {
      out.push([t, t + SHORT]);
      t += SHORT + GAP;
    }
  }
  return out;
}

/**
 * Center mark (ASME Y14.2): small cross at the center, then a gap, then
 * center-line dashes running 1/8" past the circle when there's room.
 */
export function centerMark(layer: Layer, c: Pt, r: number) {
  const cross = 0.0625;
  const gap = 0.0625;
  const outer = r + 0.125;
  const dirs = [pt(1, 0), pt(-1, 0), pt(0, 1), pt(0, -1)];
  if (outer - (cross + gap) >= 0.1) {
    layer.path(line(pt(c.x - cross, c.y), pt(c.x + cross, c.y)));
    layer.path(line(pt(c.x, c.y - cross), pt(c.x, c.y + cross)));
    for (const d of dirs) {
      for (const [a, b] of centerDashes(cross + gap, outer)) {
        layer.path(line(add(c, mul(d, a)), add(c, mul(d, b))));
      }
    }
  } else {
    const reach = Math.max(r + 0.0625, cross);
    layer.path(line(pt(c.x - reach, c.y), pt(c.x + reach, c.y)));
    layer.path(line(pt(c.x, c.y - reach), pt(c.x, c.y + reach)));
  }
}
