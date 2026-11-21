/** Which key dimensions a queue part gets, and where they come from. */

import type { DxfAnalysis } from "@/types/analysis";
import { keyDimensionsFromAnalysis, keyDimensionsFromBox, type KeyDimension } from "./key-dimensions";
import { asModelSize } from "./model-size";
import { keyDimensionsFromHoles, type CachedHoles } from "./step-holes";

export interface DimensionSourceInput {
  fileType: string;
  analysis: DxfAnalysis | null;
  /** cached `parts.model_size_in` (inches) */
  modelSize: unknown;
  thicknessIn: number | null;
  /** STEP hole groups (cached or freshly derived); absent = box only */
  holes?: CachedHoles | null;
}

export interface PartDimensions {
  /** null while a STEP/STL model still has to be measured; [] = nothing to check */
  dims: KeyDimension[] | null;
  /** hole sizes recognized but left out of the check (cap) */
  omittedHoles: number;
}

/** DXF needs its analysis; STEP/STL need their box (cached or measured). PDFs have nothing. */
export function isVerifiable(fileType: string): boolean {
  return fileType === "dxf" || fileType === "step" || fileType === "stl";
}

/** Box (and, for STEP, the most important hole sizes) or DXF profile + hole groups. */
export function partDimensions(input: DimensionSourceInput): PartDimensions {
  const opts = { thicknessIn: input.thicknessIn };
  if (input.fileType === "dxf") {
    return { dims: input.analysis ? keyDimensionsFromAnalysis(input.analysis, opts) : [], omittedHoles: 0 };
  }
  if (input.fileType === "step" || input.fileType === "stl") {
    const size = asModelSize(input.modelSize);
    if (!size) return { dims: null, omittedHoles: 0 };
    const box = keyDimensionsFromBox(size, opts);
    if (input.fileType !== "step" || !input.holes) return { dims: box, omittedHoles: 0 };
    const holes = keyDimensionsFromHoles(input.holes);
    return { dims: [...box, ...holes.dims], omittedHoles: holes.omitted };
  }
  return { dims: [], omittedHoles: 0 };
}

/**
 * Key dimensions for a part, or null when a STEP/STL model still has to be
 * measured (no cached box yet). [] means nothing to check.
 */
export function keyDimensionsForPart(input: DimensionSourceInput): KeyDimension[] | null {
  return partDimensions(input).dims;
}
