/**
 * 1-bit rasters as the printer takes them: rows top to bottom, `bytesPerRow`
 * bytes each, MSB = leftmost dot, bit set = black. Pure — no browser APIs.
 */
export interface Raster {
  widthDots: number;
  heightDots: number;
  bytesPerRow: number;
  data: Uint8Array;
}

export function blankRaster(widthDots: number, heightDots: number): Raster {
  const bytesPerRow = Math.ceil(widthDots / 8);
  return { widthDots, heightDots, bytesPerRow, data: new Uint8Array(bytesPerRow * heightDots) };
}

export function getDot(r: Raster, x: number, y: number): boolean {
  return (r.data[y * r.bytesPerRow + (x >> 3)] & (0x80 >> (x & 7))) !== 0;
}

export function setDot(r: Raster, x: number, y: number): void {
  r.data[y * r.bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
}

/** Luminance below `threshold` (0–255) prints black; transparency reads as white paper. */
export function rgbaToRaster(
  rgba: ArrayLike<number>,
  widthDots: number,
  heightDots: number,
  threshold = 128,
): Raster {
  if (rgba.length !== widthDots * heightDots * 4) throw new RangeError("pixel buffer does not match its size");
  const out = blankRaster(widthDots, heightDots);
  for (let y = 0; y < heightDots; y++) {
    for (let x = 0; x < widthDots; x++) {
      const i = (y * widthDots + x) * 4;
      const a = rgba[i + 3];
      // integer Rec. 601 weights (exact for greys), composited over white paper
      const lum = (299 * rgba[i] + 587 * rgba[i + 1] + 114 * rgba[i + 2]) / 1000;
      if ((lum * a + 255 * (255 - a)) / 255 < threshold) setDot(out, x, y);
    }
  }
  return out;
}

/**
 * Where a label narrower than the head sits on it. "center" pads to the full
 * head with the label centered (phomymo's M110 definition: widthBytes 48,
 * alignment center); "none" sends just the label width (pyphomemo / CUPS).
 */
export type HeadPlacement = "center" | "left" | "right" | "none";

export interface Placed {
  raster: Raster;
  /** dots from the head's left edge to the label raster's left edge */
  offsetDots: number;
}

export function placeOnHead(label: Raster, headDots: number, placement: HeadPlacement): Placed {
  if (placement === "none") return { raster: label, offsetDots: 0 };
  if (label.widthDots > headDots) throw new RangeError("label raster is wider than the print head");
  const slack = headDots - label.widthDots;
  const offsetDots = placement === "left" ? 0 : placement === "right" ? slack : Math.floor(slack / 2);
  const out = blankRaster(headDots, label.heightDots);
  for (let y = 0; y < label.heightDots; y++) {
    for (let x = 0; x < label.widthDots; x++) if (getDot(label, x, y)) setDot(out, x + offsetDots, y);
  }
  return { raster: out, offsetDots };
}

/** RGBA pixels (black ink on white) for a window of a raster — the preview. */
export function rasterToRgba(r: Raster, x0 = 0, width = r.widthDots): Uint8ClampedArray<ArrayBuffer> {
  const px = new Uint8ClampedArray(width * r.heightDots * 4);
  for (let y = 0; y < r.heightDots; y++) {
    for (let x = 0; x < width; x++) {
      const v = getDot(r, x0 + x, y) ? 0 : 255;
      const i = (y * width + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = 255;
    }
  }
  return px;
}
