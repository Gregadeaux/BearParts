/** Display strings for key dimensions — shared by the verify flow, history, and anything else. */

import { formatInches, type KeyDimension } from "./key-dimensions";

/** "Overall length", "Hole ⌀ (4×)" */
export function dimensionTitle(dim: Pick<KeyDimension, "label" | "count">): string {
  return dim.count && dim.count > 1 ? `${dim.label} (${dim.count}×)` : dim.label;
}

const HINTS: Record<KeyDimension["kind"], string> = {
  length: "End to end, longest side",
  width: "Side to side, across",
  height: "Top to bottom",
  thickness: "Stock thickness",
  hole_diameter: "Measure the worst one",
  // calipers can't touch a center: one correct method each, enter the result
  hole_spacing: "Inside jaws across both holes, minus one hole ⌀",
  edge_distance: "Edge to near side of hole, plus half the hole ⌀",
};

/**
 * One terse line under the title on the (blind) entry step: how to hold the
 * calipers. Never a number, never the hole-match note — "1/4-20 tap" gives
 * the nominal away.
 */
export function dimensionHint(dim: Pick<KeyDimension, "kind" | "count">): string {
  if (dim.kind !== "hole_diameter") return HINTS[dim.kind];
  return dim.count && dim.count > 1 ? HINTS.hole_diameter : "Hole diameter";
}

/** Signed, three decimals, true minus sign: +0.004 / −0.012 / 0.000 */
export function formatDeviation(deviation: number): string {
  const text = formatInches(Math.abs(deviation));
  if (text === formatInches(0)) return text;
  return `${deviation > 0 ? "+" : "−"}${text}`;
}

/** ±0.010 */
export function formatTolerance(tolerance: number): string {
  return `±${formatInches(tolerance)}`;
}
