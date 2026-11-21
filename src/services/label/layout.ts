/**
 * Label layout at the printer's native dot grid — pure math, no canvas. Text
 * widths come from an injected measurer (canvas in the browser, a fake in tests).
 */
import { qrMatrix, QR_QUIET_MODULES } from "@/services/drawing/qr";
import { M110 } from "./m110";

export interface LabelContent {
  title: string;
  material?: string | null;
  qty?: number | null;
  /** part page link, printed as the QR code; none drawn when null */
  url: string | null;
}

export interface LabelSize {
  widthMm: number;
  heightMm: number;
}

export type MeasureText = (text: string, fontPx: number, bold: boolean) => number;

export interface QrPlacement {
  matrix: boolean[][];
  /** top-left of the square including the quiet zone, dots */
  x: number;
  y: number;
  /** whole dots per module, so every module prints as the same dot block */
  modulePx: number;
  /** side of the square including the 4-module quiet zone, dots */
  sizeDots: number;
}

export interface TextLine {
  text: string;
  x: number;
  /** top of the line box, dots */
  y: number;
  fontPx: number;
  bold: boolean;
}

export interface LabelLayout {
  widthDots: number;
  heightDots: number;
  qr: QrPlacement | null;
  lines: TextLine[];
}

/** Text keeps 1.5 mm off the label edges (the CUPS driver reserves 1 mm). */
export const TEXT_MARGIN = 12;
/** Quiet zone may run to 0.5 mm from the edge — the quiet zone itself is white. */
const QR_EDGE = 4;
/** The QR takes at most this share of the label's long side, leaving room for text. */
const QR_MAX_SHARE = 0.6;
const MIN_MODULE_PX = 2;
const TITLE_PX = [32, 30, 28, 26, 24, 22, 20, 18, 16];
const META_PX = [20, 18, 16, 14];
const LINE_HEIGHT = 1.15;
const META_GAP = 6;
const ELLIPSIS = "…";

/** Printable dots for a label: width capped at the head (a 50 mm label prints 48 mm). */
export function labelDots(size: LabelSize): { widthDots: number; heightDots: number } {
  if (!(size.widthMm > 0 && size.heightMm > 0)) throw new RangeError("label size must be positive");
  return {
    widthDots: Math.min(Math.round(size.widthMm * M110.dotsPerMm), M110.headDots),
    heightDots: Math.round(size.heightMm * M110.dotsPerMm),
  };
}

const lineBox = (px: number) => Math.round(px * LINE_HEIGHT);

export function layoutLabel(content: LabelContent, size: LabelSize, measure: MeasureText): LabelLayout {
  const { widthDots: W, heightDots: H } = labelDots(size);
  const stacked = size.heightMm > size.widthMm;
  let box = { x: TEXT_MARGIN, y: TEXT_MARGIN, w: W - 2 * TEXT_MARGIN, h: H - 2 * TEXT_MARGIN };
  let qr: QrPlacement | null = null;

  if (content.url) {
    const matrix = qrMatrix(content.url);
    const modules = matrix.length + 2 * QR_QUIET_MODULES;
    const limit = stacked
      ? Math.min(W - 2 * QR_EDGE, Math.floor(H * QR_MAX_SHARE) - QR_EDGE)
      : Math.min(H - 2 * QR_EDGE, Math.floor(W * QR_MAX_SHARE) - QR_EDGE);
    const modulePx = Math.floor(limit / modules);
    if (modulePx < MIN_MODULE_PX) throw new RangeError("Label too small for the QR code");
    const side = modulePx * modules;
    if (stacked) {
      qr = { matrix, modulePx, sizeDots: side, x: Math.floor((W - side) / 2), y: QR_EDGE };
      box = { x: TEXT_MARGIN, y: QR_EDGE + side, w: W - 2 * TEXT_MARGIN, h: H - QR_EDGE - side - TEXT_MARGIN };
    } else {
      qr = { matrix, modulePx, sizeDots: side, x: QR_EDGE, y: Math.floor((H - side) / 2) };
      box = { x: QR_EDGE + side, y: TEXT_MARGIN, w: W - QR_EDGE - side - TEXT_MARGIN, h: H - 2 * TEXT_MARGIN };
    }
  }

  const meta = metaLines(content, box.w, measure);
  const metaH = meta.reduce((s, m) => s + lineBox(m.fontPx), 0);
  const titleRoom = box.h - (meta.length ? metaH + META_GAP : 0);
  const title = fitTitle(content.title.trim(), box.w, Math.max(titleRoom, 0), measure);
  const titleH = title.lines.length * lineBox(title.px);

  const lines: TextLine[] = [];
  // title on top, meta along the bottom; a lone title sits centered
  let y = meta.length ? box.y : box.y + Math.max(0, Math.floor((box.h - titleH) / 2));
  for (const text of title.lines) {
    lines.push({ text, x: box.x, y, fontPx: title.px, bold: true });
    y += lineBox(title.px);
  }
  y = box.y + box.h - metaH;
  for (const m of meta) {
    lines.push({ ...m, x: box.x, y });
    y += lineBox(m.fontPx);
  }
  return { widthDots: W, heightDots: H, qr, lines };
}

function metaLines(c: LabelContent, maxW: number, measure: MeasureText) {
  const out: { text: string; fontPx: number; bold: boolean }[] = [];
  const material = c.material?.trim();
  if (material) out.push(fitLine(material, maxW, false, measure));
  if (c.qty != null && c.qty > 0) out.push(fitLine(`Qty ${c.qty}`, maxW, true, measure));
  return out;
}

/** One line: shrink to the smallest meta size, then cut with an ellipsis. */
function fitLine(text: string, maxW: number, bold: boolean, measure: MeasureText) {
  const px = META_PX.find((p) => measure(text, p, bold) <= maxW) ?? META_PX[META_PX.length - 1];
  return { text: ellipsize(text, maxW, px, bold, measure), fontPx: px, bold };
}

/**
 * Largest title size whose word-wrapped lines fit without splitting a word; at
 * the smallest size words may split and the last line is cut with an ellipsis.
 */
function fitTitle(title: string, maxW: number, maxH: number, measure: MeasureText) {
  if (!title) return { px: TITLE_PX[0], lines: [] as string[] };
  const words = title.split(/\s+/);
  for (const px of TITLE_PX) {
    if (words.some((w) => measure(w, px, true) > maxW)) continue;
    const lines = wrap(title, maxW, px, measure);
    if (lines.length * lineBox(px) <= maxH) return { px, lines };
  }
  const px = TITLE_PX[TITLE_PX.length - 1];
  const fits = Math.max(1, Math.floor(maxH / lineBox(px)));
  const lines = wrap(title, maxW, px, measure);
  if (lines.length <= fits) return { px, lines };
  const kept = lines.slice(0, fits);
  kept[fits - 1] = ellipsize(`${kept[fits - 1]}${ELLIPSIS}`, maxW, px, true, measure);
  return { px, lines: kept };
}

/** Greedy word wrap; a word wider than the line breaks between characters. */
export function wrap(text: string, maxW: number, px: number, measure: MeasureText): string[] {
  const fits = (s: string) => measure(s, px, true) <= maxW;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const joined = line ? `${line} ${word}` : word;
    if (fits(joined)) {
      line = joined;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    while (!fits(line) && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && !fits(line.slice(0, cut))) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** `text` as-is when it fits, else trimmed to fit with a trailing ellipsis. */
export function ellipsize(text: string, maxW: number, px: number, bold: boolean, measure: MeasureText): string {
  if (measure(text, px, bold) <= maxW) return text;
  let s = text.endsWith(ELLIPSIS) ? text.slice(0, -1) : text;
  while (s.length > 0 && measure(`${s.trimEnd()}${ELLIPSIS}`, px, bold) > maxW) s = s.slice(0, -1);
  return `${s.trimEnd()}${ELLIPSIS}`;
}
