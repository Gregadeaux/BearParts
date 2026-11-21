/**
 * Drafting number formats (ASME Y14.5 inch practice): three decimals, no
 * leading zero below one inch — 0.25 → ".250", 1.5 → "1.500".
 */

export function fmtIn(value: number, places = 3): string {
  const factor = 10 ** places;
  // settle float noise first (mesh .0624999 is .0625) so halves round up
  const clean = Math.round(Math.abs(value) * 1e6) / 1e6;
  const rounded = Math.round(clean * factor) / factor;
  let s = rounded.toFixed(places);
  if (s.startsWith("0.")) s = s.slice(1);
  return value < 0 && rounded !== 0 ? `-${s}` : s;
}

/** Ordinate values: the datum is a bare "0". */
export function fmtOrdinate(value: number): string {
  return Math.abs(value) < 0.0005 ? "0" : fmtIn(value);
}

/** ± tolerance, e.g. 0.01 → "±.010". */
export const fmtTol = (tol: number) => `±${fmtIn(tol)}`;

/** Scale factor → "2:1", "1:1", "1:4". */
export function fmtScale(scale: number): string {
  if (scale >= 1) return `${round2(scale)}:1`;
  return `1:${round2(1 / scale)}`;
}

const round2 = (v: number) => parseFloat(v.toFixed(2));

/** Feature counts: "4X " prefix, nothing for a single feature. */
export const countPrefix = (n: number) => (n > 1 ? `${n}X ` : "");

/** Drafting text is uppercase; collapse whitespace so cells stay one line. */
export const upper = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();

/** "2026-11-20" (ASME Y14.1 date format). */
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Safe download name: "<part name> - drawing.pdf". */
export function drawingFileName(partName: string): string {
  const base = partName.replace(/[\\/:*?"<>|]+/g, "").trim() || "part";
  return `${base} - drawing.pdf`;
}
