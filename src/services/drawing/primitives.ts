/**
 * The drawing model: a flat list of vector shapes in SHEET coordinates —
 * inches, origin at the sheet's lower-left corner, y up. Layout code builds a
 * `Sheet`; only pdf-writer.ts knows about jsPDF. Pure and isomorphic.
 */

export interface Pt {
  x: number;
  y: number;
}

/** ASME Y14.2 line weights: thick for visible outlines, thin for dims/centers. */
export type Weight = "thick" | "medium" | "thin";

export const LINE_WEIGHT_IN: Record<Weight, number> = {
  thick: 0.6 / 25.4, // visible object lines
  medium: 0.45 / 25.4, // sheet border, title-block frame
  thin: 0.3 / 25.4, // dimension, extension, center, leader lines
};

export type PathCmd =
  | { op: "M"; p: Pt }
  | { op: "L"; p: Pt }
  | { op: "C"; c1: Pt; c2: Pt; p: Pt }
  | { op: "Z" };

export interface PathShape {
  kind: "path";
  cmds: PathCmd[];
  weight: Weight;
  /** filled instead of stroked (arrowheads) */
  fill?: boolean;
}

export type HAlign = "left" | "center" | "right";
/** bottom = baseline, middle = middle of capitals, top = top of capitals */
export type VAlign = "bottom" | "middle" | "top";

export interface TextShape {
  kind: "text";
  text: string;
  at: Pt;
  /** capital-letter height, inches */
  size: number;
  align: HAlign;
  valign: VAlign;
  /** degrees counter-clockwise; ordinate X values read bottom-to-top (90) */
  rotate?: 0 | 90;
  bold?: boolean;
}

export type Shape = PathShape | TextShape;

export interface Sheet {
  width: number;
  height: number;
  shapes: Shape[];
}

export const pt = (x: number, y: number): Pt => ({ x, y });
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
export const len = (a: Pt): number => Math.hypot(a.x, a.y);
export const unit = (a: Pt): Pt => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
export const polar = (c: Pt, r: number, angle: number): Pt => ({
  x: c.x + r * Math.cos(angle),
  y: c.y + r * Math.sin(angle),
});

export function line(a: Pt, b: Pt, weight: Weight = "thin"): PathShape {
  return { kind: "path", cmds: [{ op: "M", p: a }, { op: "L", p: b }], weight };
}

export function polyline(pts: Pt[], closed: boolean, weight: Weight, fill = false): PathShape {
  const cmds: PathCmd[] = pts.map((p, i) => ({ op: i === 0 ? "M" : "L", p }) as PathCmd);
  if (closed) cmds.push({ op: "Z" });
  return { kind: "path", cmds, weight, fill };
}

export function rect(x: number, y: number, w: number, h: number, weight: Weight): PathShape {
  return polyline([pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h)], true, weight);
}

/**
 * Cubic Bézier commands for a circular arc from angle a0 sweeping `sweep`
 * radians (positive = CCW). Split into ≤90° pieces — max radial error ~0.03%.
 * Does not emit the initial move.
 */
export function arcCmds(c: Pt, r: number, a0: number, sweep: number): PathCmd[] {
  const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
  const step = sweep / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const cmds: PathCmd[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = a0 + i * step;
    const t1 = t0 + step;
    const p0 = polar(c, r, t0);
    const p1 = polar(c, r, t1);
    cmds.push({
      op: "C",
      c1: { x: p0.x - k * r * Math.sin(t0), y: p0.y + k * r * Math.cos(t0) },
      c2: { x: p1.x + k * r * Math.sin(t1), y: p1.y - k * r * Math.cos(t1) },
      p: p1,
    });
  }
  return cmds;
}

export function arc(c: Pt, r: number, a0: number, sweep: number, weight: Weight): PathShape {
  return { kind: "path", cmds: [{ op: "M", p: polar(c, r, a0) }, ...arcCmds(c, r, a0, sweep)], weight };
}

export function circle(c: Pt, r: number, weight: Weight, fill = false): PathShape {
  return {
    kind: "path",
    cmds: [{ op: "M", p: polar(c, r, 0) }, ...arcCmds(c, r, 0, 2 * Math.PI), { op: "Z" }],
    weight,
    fill,
  };
}

export function text(
  s: string,
  at: Pt,
  size: number,
  opts: Partial<Omit<TextShape, "kind" | "text" | "at" | "size">> = {},
): TextShape {
  return {
    kind: "text",
    text: s,
    at,
    size,
    align: opts.align ?? "left",
    valign: opts.valign ?? "bottom",
    rotate: opts.rotate ?? 0,
    bold: opts.bold ?? false,
  };
}
