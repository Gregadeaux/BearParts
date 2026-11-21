/** Pure layout helpers: standard scales, ordinate dedupe, 1-D label spreading. */

/** Standard drawing scales, largest first (no enlargement beyond 2:1). */
export const STANDARD_SCALES = [2, 1, 1 / 2, 1 / 4, 1 / 8, 1 / 16, 1 / 32];

/**
 * Largest standard scale at which a `w × h` (inches) view fits `availW × availH`.
 * Falls back to the smallest scale for absurdly large parts.
 */
export function pickScale(w: number, h: number, availW: number, availH: number): number {
  for (const s of STANDARD_SCALES) {
    if (w * s <= availW + 1e-9 && h * s <= availH + 1e-9) return s;
  }
  return STANDARD_SCALES[STANDARD_SCALES.length - 1];
}

/**
 * Distinct values, ascending, merging anything within `tol` of the previous
 * kept value (so .3749 and .3751 become one ordinate).
 */
export function dedupeValues(values: number[], tol = 0.0005): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || v - out[out.length - 1] > tol) out.push(v);
  }
  return out;
}

/**
 * Spread label centers so neighbors sit at least `gap` apart while moving as
 * little as possible (least squares per cluster), clamped to [lo, hi].
 * Input must be ascending; output keeps the order. Returns null when the
 * labels cannot fit in the range at all.
 */
export function spreadLabels(
  desired: number[],
  gap: number,
  lo = -Infinity,
  hi = Infinity,
): number[] | null {
  const n = desired.length;
  if (n === 0) return [];
  if ((n - 1) * gap > hi - lo + 1e-9) return null;

  // clusters of consecutive labels packed at exactly `gap` spacing
  type Cluster = { first: number; count: number; start: number };
  const bestStart = (first: number, count: number) => {
    let s = 0;
    for (let i = 0; i < count; i++) s += desired[first + i] - i * gap;
    const start = s / count;
    return Math.min(Math.max(start, lo), hi - (count - 1) * gap);
  };

  const clusters: Cluster[] = [];
  for (let i = 0; i < n; i++) {
    clusters.push({ first: i, count: 1, start: bestStart(i, 1) });
    // merge backwards while the newest cluster collides with its predecessor
    while (clusters.length > 1) {
      const cur = clusters[clusters.length - 1];
      const prev = clusters[clusters.length - 2];
      if (prev.start + prev.count * gap <= cur.start + 1e-9) break;
      clusters.pop();
      prev.count += cur.count;
      prev.start = bestStart(prev.first, prev.count);
    }
  }

  const out: number[] = [];
  for (const c of clusters) for (let i = 0; i < c.count; i++) out.push(c.start + i * gap);
  return out;
}

/** Largest |placed − desired| — how far a label had to jog from its feature. */
export function maxDisplacement(desired: number[], placed: number[]): number {
  let m = 0;
  for (let i = 0; i < desired.length; i++) m = Math.max(m, Math.abs(placed[i] - desired[i]));
  return m;
}
