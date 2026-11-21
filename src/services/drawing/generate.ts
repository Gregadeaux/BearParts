import type { DrawingSource } from "@/types/drawing";
import type { DxfAnalysis } from "@/types/analysis";
import { analyzeDxfText } from "@/services/dxf/analysis.service";
import { modelScaleToInches } from "@/services/dimensions/model-size";
import { buildDxfSheet, type DxfSheetResult } from "./dxf-sheet";
import { buildModelSheet } from "./model-sheet";
import { isoDate } from "./format";
import type { DrawingMeta } from "./notes";
import { sheetToPdf } from "./pdf-writer";

/** What the dialog collects; everything else comes from the DrawingSource. */
export interface DrawingInputs {
  thicknessIn: number | null;
  material: string | null;
  drafter: string | null;
  date?: Date;
}

export function drawingMeta(source: DrawingSource, inputs: DrawingInputs, unitsNote: string | null): DrawingMeta {
  return {
    title: source.name,
    drafter: inputs.drafter?.trim() || null,
    date: isoDate(inputs.date ?? new Date()),
    material: inputs.material?.trim() || null,
    thicknessIn: inputs.thicknessIn && inputs.thicknessIn > 0 ? inputs.thicknessIn : null,
    quantity: source.quantity,
    revision: source.revision,
    fileName: `${source.name}.${source.fileType}`,
    unitsNote,
  };
}

/** Truthful note about how DXF units were resolved (null when declared inches). */
export function dxfUnitsNote(analysis: DxfAnalysis): string | null {
  const declared = analysis.unitsSource === "header";
  if (analysis.units === "mm") {
    return declared
      ? "CAD FILE IS IN MILLIMETERS; DIMENSIONS CONVERTED TO INCHES."
      : "CAD FILE UNITS NOT DECLARED; READ AS MILLIMETERS AND CONVERTED TO INCHES.";
  }
  return declared ? null : "CAD FILE UNITS NOT DECLARED; READ AS INCHES.";
}

/**
 * Raw STEP/STL coordinates → multi-view drawing. STEP arrives in mm from
 * occt; STL is unitless and read as mm unless the part says inches — the
 * same rule the verification flow uses (modelScaleToInches).
 */
export function meshDrawing(
  rawPositions: ArrayLike<number>,
  source: DrawingSource,
  inputs: DrawingInputs,
  /** STEP only: B-rep face per triangle, so only true model edges are drawn */
  faceIds: ArrayLike<number> | null = null,
) {
  const fileType = source.fileType === "stl" ? "stl" : "step";
  const k = modelScaleToInches(fileType, source.units);
  const positions = new Float64Array(rawPositions.length);
  for (let i = 0; i < positions.length; i++) positions[i] = rawPositions[i] * k;
  const unitsNote =
    fileType === "stl" && source.units !== "in" ? "STL FILE HAS NO UNITS; READ AS MILLIMETERS AND CONVERTED TO INCHES." : null;
  const result = buildModelSheet(positions, drawingMeta(source, inputs, unitsNote), faceIds);
  const pdf = sheetToPdf(result.sheet, { title: source.name, author: inputs.drafter ?? undefined });
  return { pdf, result };
}

/** DXF text → flat-profile drawing. Pure; runs in the browser or in tests. */
export function dxfDrawing(dxfText: string, source: DrawingSource, inputs: DrawingInputs) {
  const override = source.units === "unknown" ? undefined : source.units;
  const { entities, analysis } = analyzeDxfText(dxfText, override);
  const result: DxfSheetResult = buildDxfSheet(entities, analysis, drawingMeta(source, inputs, dxfUnitsNote(analysis)));
  const pdf = sheetToPdf(result.sheet, { title: source.name, author: inputs.drafter ?? undefined });
  return { pdf, result };
}
