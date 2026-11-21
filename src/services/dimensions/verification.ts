/**
 * Grading a verification: pure, shared by the flow and the server action
 * (which re-grades before saving so a record is always consistent).
 *
 * Entry is BLIND: the student never sees the nominal, tolerance, or any
 * pass/fail until every dimension is entered or skipped (the summary). The
 * sanity guard here therefore never looks at the nominal.
 */

import type { MeasuredDimension, VerificationResult } from "@/types/verification";
import { checkDimension, type KeyDimension, type KeyDimensionKind } from "./key-dimensions";

const KINDS: KeyDimensionKind[] = ["length", "width", "height", "thickness", "hole_diameter"];
const MAX_DIMENSIONS = 50;
/** No FRC part is 500" — anything bigger is a typo (or millimeters). */
export const MAX_READING_IN = 500;

/** "4.26", ".26", "4,26" → number; blank / junk / negative → null. Format only. */
export function parseMeasurement(raw: string): number | null {
  const text = raw.trim().replace(",", ".").replace(/["”]|in$/gi, "").trim();
  if (!/^\d*\.?\d+$|^\d+\.$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

const plausible = (v: number) => v > 0 && v <= MAX_READING_IN;

/**
 * A caliper reading as typed. Blank = nothing yet (no complaint). Anything
 * impossible gets a neutral message that says nothing about the nominal.
 */
export function checkReading(raw: string): { value: number | null; problem: string | null } {
  if (raw.trim() === "") return { value: null, problem: null };
  const value = parseMeasurement(raw);
  if (value === null) return { value: null, problem: "Numbers only, in inches" };
  if (value <= 0) return { value: null, problem: "Has to be more than 0" };
  if (value > MAX_READING_IN) return { value: null, problem: "Too big — inches, not mm?" };
  return { value, problem: null };
}

export function gradeDimension(dim: KeyDimension, measured: number | null): MeasuredDimension {
  if (measured === null) return { ...dim, measured: null, deviation: null, pass: null };
  const { pass, deviation } = checkDimension(dim, measured);
  return { ...dim, measured, deviation, pass };
}

/** Any miss fails; otherwise any skip is incomplete; otherwise pass. */
export function overallResult(rows: MeasuredDimension[]): VerificationResult {
  if (rows.some((r) => r.pass === false)) return "fail";
  if (rows.length === 0 || rows.some((r) => r.measured === null)) return "incomplete";
  return "pass";
}

/**
 * Honesty after the reveal: any reading that differs from what was entered
 * before the summary was first shown is flagged `revised`, keeping the
 * pre-reveal value (null = it was skipped) as `firstMeasured`.
 */
export function markRevisions(
  rows: MeasuredDimension[],
  firstSeen: Record<string, number | null> | null,
): MeasuredDimension[] {
  if (!firstSeen) return rows;
  return rows.map((row) => {
    if (!(row.id in firstSeen)) return row;
    const first = firstSeen[row.id];
    return first === row.measured ? row : { ...row, revised: true, firstMeasured: first };
  });
}

/**
 * Figure geometry (hole centers etc.) is display-only — strip it before a
 * record goes over the wire. sanitizeMeasurements drops it server-side too.
 */
export function withoutFeatures(rows: MeasuredDimension[]): MeasuredDimension[] {
  return rows.map((row) => {
    const copy = { ...row };
    delete copy.feature;
    return copy;
  });
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const reading = (v: unknown) => v === null || (finite(v) && plausible(v));

/**
 * Validate untrusted input (a server action argument) and re-grade it from
 * `measured`. Keeps the optional revision flags; drops everything else.
 * Throws on anything malformed.
 */
export function sanitizeMeasurements(input: unknown): MeasuredDimension[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_DIMENSIONS) {
    throw new Error("Nothing to record");
  }
  return input.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const kind = r.kind as KeyDimensionKind;
    const revised = r.revised === true;
    if (
      typeof r.id !== "string" ||
      !KINDS.includes(kind) ||
      typeof r.label !== "string" ||
      !finite(r.nominal) ||
      r.nominal <= 0 ||
      !finite(r.tolerance) ||
      r.tolerance <= 0 ||
      !reading(r.measured) ||
      (r.revised !== undefined && typeof r.revised !== "boolean") ||
      (revised && !reading(r.firstMeasured))
    ) {
      throw new Error("Invalid measurement");
    }
    const dim: KeyDimension = {
      id: r.id.slice(0, 40),
      kind,
      label: r.label.slice(0, 80),
      nominal: r.nominal,
      tolerance: r.tolerance,
      ...(finite(r.count) && r.count > 0 ? { count: Math.round(r.count) } : {}),
      ...(typeof r.note === "string" && r.note ? { note: r.note.slice(0, 120) } : {}),
    };
    const graded = gradeDimension(dim, r.measured as number | null);
    return revised ? { ...graded, revised: true, firstMeasured: r.firstMeasured as number | null } : graded;
  });
}
