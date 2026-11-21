import type { LabelSize } from "./layout";
import type { HeadPlacement } from "./raster";

/** Common M110 die-cut sizes, width (across the head) × length, mm. */
export const LABEL_SIZES = [
  { value: "30x20", label: "30 × 20 mm", widthMm: 30, heightMm: 20 },
  { value: "40x20", label: "40 × 20 mm", widthMm: 40, heightMm: 20 },
  { value: "40x30", label: "40 × 30 mm", widthMm: 40, heightMm: 30 },
  { value: "40x40", label: "40 × 40 mm", widthMm: 40, heightMm: 40 },
  { value: "50x30", label: "50 × 30 mm", widthMm: 50, heightMm: 30 },
] as const;

export type LabelSizeKey = (typeof LABEL_SIZES)[number]["value"];

export const DEFAULT_LABEL_SIZE: LabelSizeKey = "40x30";

export function labelSize(key: string): LabelSize {
  const s = LABEL_SIZES.find((x) => x.value === key) ?? LABEL_SIZES.find((x) => x.value === DEFAULT_LABEL_SIZE)!;
  return { widthMm: s.widthMm, heightMm: s.heightMm };
}

export const isLabelSizeKey = (v: unknown): v is LabelSizeKey => LABEL_SIZES.some((s) => s.value === v);

/**
 * Pad to the full 384-dot head with the label centered (phomymo's M110
 * definition; works whether or not the firmware centers narrow rasters itself).
 * If the first real print sits off-center, "none" (send label width only, as
 * pyphomemo does) is the first thing to try.
 */
export const HEAD_PLACEMENT: HeadPlacement = "center";
