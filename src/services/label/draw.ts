/**
 * Thin canvas adapter: paints a LabelLayout and reads it back as the 1-bit
 * raster that gets sent. The canvas is injected, so tests can pass a fake.
 */
import { QR_QUIET_MODULES } from "@/services/drawing/qr";
import { M110 } from "./m110";
import { layoutLabel, type LabelContent, type LabelLayout, type LabelSize, type MeasureText } from "./layout";
import { placeOnHead, rgbaToRaster, type HeadPlacement, type Raster } from "./raster";

/** The slice of CanvasRenderingContext2D the label needs. */
export interface LabelContext {
  fillStyle: unknown;
  font: string;
  textBaseline: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  getImageData(x: number, y: number, w: number, h: number): { data: ArrayLike<number> };
}

export type CreateContext = (widthDots: number, heightDots: number) => LabelContext;

/** Bold sans everywhere a phone or laptop has one; thermal heads like heavy strokes. */
export const fontCss = (px: number, bold: boolean) => `${bold ? "bold " : ""}${px}px Arial, Helvetica, sans-serif`;

export function canvasMeasure(ctx: LabelContext): MeasureText {
  return (text, px, bold) => {
    ctx.font = fontCss(px, bold);
    return ctx.measureText(text).width;
  };
}

/** White paper, QR as whole-dot module rects (one per dark run), black text. */
export function drawLabel(ctx: LabelContext, layout: LabelLayout): void {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, layout.widthDots, layout.heightDots);
  ctx.fillStyle = "#000";
  const qr = layout.qr;
  if (qr) {
    const m = qr.modulePx;
    const origin = (i: number) => (QR_QUIET_MODULES + i) * m;
    qr.matrix.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (!row[c]) continue;
        const start = c;
        while (c < row.length && row[c]) c++;
        ctx.fillRect(qr.x + origin(start), qr.y + origin(r), (c - start) * m, m);
      }
    });
  }
  ctx.textBaseline = "top";
  for (const line of layout.lines) {
    ctx.font = fontCss(line.fontPx, line.bold);
    ctx.fillText(line.text, line.x, line.y);
  }
}

export interface LabelPrint {
  layout: LabelLayout;
  /** the label area only */
  label: Raster;
  /** what is sent: the label placed on the head width */
  head: Raster;
  /** where the label starts on `head` */
  offsetDots: number;
}

/** Pick the dark threshold a touch above mid-grey so antialiased strokes stay solid. */
export const INK_THRESHOLD = 150;

export function renderLabel(
  content: LabelContent,
  size: LabelSize,
  createContext: CreateContext,
  placement: HeadPlacement = "center",
): LabelPrint {
  const measureCtx = createContext(1, 1);
  const layout = layoutLabel(content, size, canvasMeasure(measureCtx));
  const ctx = createContext(layout.widthDots, layout.heightDots);
  drawLabel(ctx, layout);
  const { data } = ctx.getImageData(0, 0, layout.widthDots, layout.heightDots);
  const label = rgbaToRaster(data, layout.widthDots, layout.heightDots, INK_THRESHOLD);
  const placed = placeOnHead(label, M110.headDots, placement);
  return { layout, label, head: placed.raster, offsetDots: placed.offsetDots };
}

/** Browser factory: a detached <canvas>, no smoothing so module edges stay crisp. */
export const browserContext: CreateContext = (w, h) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available");
  ctx.imageSmoothingEnabled = false;
  return ctx;
};
