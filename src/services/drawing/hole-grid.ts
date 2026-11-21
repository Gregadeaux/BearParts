/** Drafting text for hole patterns (the patterns themselves: services/dimensions/hole-patterns). */

import type { PatternDirection } from "@/services/dimensions/hole-patterns";
import { fmtIn } from "./format";

/**
 * Repetitive-feature spacing text, longest first (ASME "nX" = n spaces):
 * "12X .500 (=6.000)", "12X .500", ".500 TYP". Callers use the first that fits.
 */
export function pitchTexts(d: Pick<PatternDirection, "count" | "pitch">): string[] {
  const n = d.count - 1;
  const p = fmtIn(d.pitch);
  if (n <= 1) return [p];
  return [`${n}X ${p} (=${fmtIn(n * d.pitch)})`, `${n}X ${p}`, `${p} TYP`];
}

/**
 * Secondary fraction for tube-stock values that are exact 64ths but don't
 * read exactly at three decimals: .4375 → "7/16". Null otherwise.
 */
export function fraction64(v: number): string | null {
  const n64 = Math.round(v * 64);
  if (n64 <= 0 || Math.abs(v * 64 - n64) > 1e-4) return null;
  if (Math.abs(Math.round(v * 1000) / 1000 - v) < 1e-6) return null; // .500 needs no help
  let num = n64, den = 64;
  while (num % 2 === 0) {
    num /= 2;
    den /= 2;
  }
  const whole = Math.floor(num / den);
  const rest = num % den;
  return whole > 0 ? `${whole}-${rest}/${den}` : `${rest}/${den}`;
}

/**
 * Edge-distance text: decimal, plus the exact fraction when it helps. A
 * 64ths value is formatted from its exact fraction, so mesh noise on
 * .4375 can't round down to ".437".
 */
export function edgeText(v: number): string[] {
  const f = fraction64(v);
  if (!f) return [fmtIn(v)];
  const exact = fmtIn(Math.round(v * 64) / 64);
  return [`${exact} (${f})`, exact];
}
