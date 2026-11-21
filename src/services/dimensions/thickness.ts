/** Stock thickness input: "0.25", ".25", '0.25"', "1/4", "1 1/2" → inches, else null. */

import { parseMeasurement } from "./verification";

const MAX_THICKNESS_IN = 24;

export function parseThicknessIn(raw: unknown): number | null {
  let value: number | null = null;
  if (typeof raw === "number") {
    value = raw;
  } else if (typeof raw === "string") {
    const text = raw.trim().replace(/["”]|in$/gi, "").trim();
    const frac = text.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
    value = frac
      ? Number(frac[1] ?? 0) + Number(frac[2]) / Number(frac[3])
      : parseMeasurement(text);
  }
  if (value === null || !Number.isFinite(value) || value <= 0 || value > MAX_THICKNESS_IN) return null;
  return Math.round(value * 10000) / 10000;
}
