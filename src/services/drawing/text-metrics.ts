import type { TextShape } from "./primitives";

/**
 * Helvetica advance widths (1/1000 em) for ASCII 32–126 — the exact table
 * jsPDF uses for its standard font, so layout here matches the PDF.
 */
// prettier-ignore
const HELVETICA = [280,280,350,550,550,890,660,190,330,330,390,580,280,330,280,280,550,550,550,550,550,550,550,550,550,550,280,280,580,580,580,550,1010,660,660,720,720,660,610,780,720,280,500,660,550,830,720,780,660,780,720,660,610,720,660,940,660,660,610,280,280,280,470,550,330,550,550,500,550,550,280,550,550,220,220,500,220,830,550,550,550,550,330,500,280,550,500,720,500,500,500,330,260,330,580];
// prettier-ignore
const HELVETICA_BOLD = [280,330,470,550,550,890,720,240,330,330,390,580,280,330,280,280,550,550,550,550,550,550,550,550,550,550,330,330,580,580,580,610,970,720,720,720,720,660,610,780,720,280,550,720,610,830,720,780,660,780,720,660,610,720,660,940,660,660,610,330,280,330,580,550,330,550,610,550,610,550,330,610,610,280,280,550,280,890,610,610,610,610,390,550,330,610,550,780,550,550,500,390,280,390,580];

/** Helvetica capital height as a fraction of the em. */
export const CAP_HEIGHT_EM = 0.718;

/**
 * Diameter symbol. The standard PDF fonts have no ⌀ glyph, so the writer
 * draws it as vector strokes; layout reserves this advance (em) for it.
 */
export const DIA = "⌀";
export const DIA_ADVANCE_EM = 0.86;
/** ASME depth symbol, also drawn as vector strokes. */
export const DEPTH = "↧";
export const DEPTH_ADVANCE_EM = 0.78;
/** ± and ° exist in WinAnsi Helvetica and render as text. */
const EXTRA_EM: Record<string, number> = { "±": 580, "°": 400, "×": 580 };

/** Em size (inches) of a font whose capitals are `capH` tall. */
export const emFor = (capH: number) => capH / CAP_HEIGHT_EM;

/** Advance width of one character in em units. */
export function charEm(ch: string, bold = false): number {
  if (ch === DIA) return DIA_ADVANCE_EM;
  if (ch === DEPTH) return DEPTH_ADVANCE_EM;
  const code = ch.charCodeAt(0);
  const table = bold ? HELVETICA_BOLD : HELVETICA;
  if (code >= 32 && code < 127) return table[code - 32] / 1000;
  return (EXTRA_EM[ch] ?? 600) / 1000;
}

/** Width in inches of `s` set with capitals `capH` tall. */
export function textWidth(s: string, capH: number, bold = false): number {
  let em = 0;
  for (const ch of s) em += charEm(ch, bold);
  return em * emFor(capH);
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Baseline-left origin of a text shape in sheet coordinates, plus its
 * direction unit vector (rotation applied).
 */
export function textOrigin(t: TextShape): { x: number; y: number; dx: number; dy: number } {
  const w = textWidth(t.text, t.size, t.bold);
  const along = t.align === "left" ? 0 : t.align === "center" ? -w / 2 : -w;
  const across = t.valign === "bottom" ? 0 : t.valign === "middle" ? -t.size / 2 : -t.size;
  if (t.rotate === 90) {
    // reading direction is +y; "up" for the glyphs is −x
    return { x: t.at.x - across, y: t.at.y + along, dx: 0, dy: 1 };
  }
  return { x: t.at.x + along, y: t.at.y + across, dx: 1, dy: 0 };
}

/** Axis-aligned box around the capitals (descenders ignored — text is uppercase). */
export function textBox(t: TextShape, pad = 0): Box {
  const w = textWidth(t.text, t.size, t.bold);
  const o = textOrigin(t);
  if (t.rotate === 90) {
    return { x0: o.x - t.size - pad, y0: o.y - pad, x1: o.x + pad, y1: o.y + w + pad };
  }
  return { x0: o.x - pad, y0: o.y - pad, x1: o.x + w + pad, y1: o.y + t.size + pad };
}
