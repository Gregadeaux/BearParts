import type { HoleMatch } from "@/types/analysis";
import { fmtIn, upper } from "./format";
import type { TitleBlockData } from "./sheet-frame";

/** What the person generating the drawing told us (all optional but the name). */
export interface DrawingMeta {
  title: string;
  drafter: string | null;
  /** YYYY-MM-DD */
  date: string;
  material: string | null;
  thicknessIn: number | null;
  quantity: number | null;
  revision: string | null;
  /** user-facing CAD file name, e.g. "Bearing plate.dxf" */
  fileName: string;
  /** extra truthful note about unit conversion, if any */
  unitsNote: string | null;
  /** part page link for the QR code; none drawn when null */
  url?: string | null;
}

export type TitleFields = Omit<TitleBlockData, "scale" | "toleranceIn" | "holeToleranceIn" | "thirdAngle">;

export function titleFields(m: DrawingMeta): TitleFields {
  return {
    title: m.title,
    drafter: m.drafter ?? "",
    date: m.date,
    material: m.material ?? "",
    thickness: m.thicknessIn ? fmtIn(m.thicknessIn) : "",
    quantity: m.quantity ? String(m.quantity) : "",
    revision: m.revision ?? "",
    fileName: m.fileName,
    qrUrl: m.url ?? null,
  };
}

function materialNote(m: DrawingMeta, withThickness: boolean): string {
  const mat = m.material?.trim() ? upper(m.material) : "NOT SPECIFIED";
  if (!withThickness) return `MATERIAL: ${mat}.`;
  const thk = m.thicknessIn ? fmtIn(m.thicknessIn) : "NOT SPECIFIED";
  return `MATERIAL: ${mat}, THK ${thk}.`;
}

const DEBURR = "REMOVE ALL BURRS AND BREAK SHARP EDGES.";

/** General notes for a flat (DXF) part — thickness lives here, not in a view. */
export function dxfNotes(m: DrawingMeta, undimensioned: boolean): string[] {
  return [
    materialNote(m, true),
    DEBURR,
    ...(undimensioned ? [`UNDIMENSIONED PROFILE GEOMETRY PER CAD FILE ${m.fileName}.`] : []),
    ...(m.unitsNote ? [m.unitsNote] : []),
  ];
}

/** General notes for a 3D model sheet. */
export function meshNotes(m: DrawingMeta, undimensioned = true): string[] {
  return [
    materialNote(m, Boolean(m.thicknessIn)),
    DEBURR,
    ...(undimensioned ? [`UNDIMENSIONED GEOMETRY PER CAD MODEL ${m.fileName}.`] : []),
    ...(m.unitsNote ? [m.unitsNote] : []),
  ];
}

/**
 * Hole-standard reference text. Ambiguous diameters list every best match
 * (0.201" is both #10 free fit and 1/4-20 tap) — never silently pick one.
 */
export function holeMatchText(matches: HoleMatch[]): string | null {
  if (matches.length === 0) return null;
  const best = Math.min(...matches.map((m) => Math.abs(m.deviation)));
  const labels = matches.filter((m) => Math.abs(m.deviation) - best < 0.0005).map((m) => upper(m.label));
  return labels.join(" / ");
}
