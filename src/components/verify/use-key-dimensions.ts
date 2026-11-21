"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DxfAnalysis } from "@/types/analysis";
import type { Part } from "@/types/part";
import type { StlMesh } from "@/services/stl/stl-parser";
import type { KeyDimension } from "@/services/dimensions/key-dimensions";
import { partDimensions } from "@/services/dimensions/part-dimensions";
import {
  asModelSize,
  modelScaleToInches,
  modelSizeCache,
  toInchesSize,
} from "@/services/dimensions/model-size";
import { asCachedHoles, deriveStepHoles, type CachedHoles } from "@/services/dimensions/step-holes";
import { cacheModelSizeAction } from "@/app/actions/parts";

const NO_HOLES: CachedHoles = { groups: [], found: 0, patterns: [], patternsFound: 0 };

interface Options {
  /** the page's STEP/STL mesh, parsed once by the 3D viewer (STEP carries face ids) */
  mesh: StlMesh | null;
  /** the page's live DXF analysis (fallback when the cached one is missing) */
  liveAnalysis: DxfAnalysis | null;
  /** the flow is open — only then do we recognize holes or write the cache */
  active: boolean;
  /** the page couldn't download / read the file — nothing will ever arrive */
  fileError?: boolean;
}

export interface KeyDimensionsState {
  /** null while a STEP/STL model still needs measuring */
  dims: KeyDimension[] | null;
  /** STEP hole sizes recognized but left out (cap) */
  omittedHoles: number;
  error: boolean;
}

/**
 * The part's key dimensions. DXF: straight from the analysis. STEP/STL: box
 * from the cached `model_size_in` or the viewer's mesh; STEP also gets its
 * most important hole sizes, recognized from the mesh's B-rep faces the first
 * time Verify opens and cached alongside the box (old box-only rows upgrade).
 * Recognition trouble silently leaves box-only dimensions.
 */
export function useKeyDimensions(
  part: Part,
  { mesh, liveAnalysis, active, fileError = false }: Options,
): KeyDimensionsState {
  const fileType = part.file_type;
  const is3d = fileType === "step" || fileType === "stl";
  const isStep = fileType === "step";
  const cachedSize = asModelSize(part.model_size_in);
  const cachedHoles = isStep ? asCachedHoles(part.model_size_in) : null;

  const measured = useMemo(
    () =>
      is3d && mesh ? toInchesSize(mesh.boundingBox.size, fileType as "step" | "stl", part.units) : null,
    [is3d, mesh, fileType, part.units],
  );
  const [derived, setDerived] = useState<CachedHoles | null>(null);
  // a mesh without face ids can't be recognized — box only
  const holes: CachedHoles | null =
    cachedHoles ?? derived ?? (isStep && mesh && !mesh.faceIds ? NO_HOLES : null);
  const needHoles = isStep && holes === null;

  // recognize lazily, off the render path, once per part (then it's cached)
  useEffect(() => {
    if (!active || !needHoles || !mesh?.faceIds) return;
    const faceIds = mesh.faceIds;
    const timer = setTimeout(() => {
      setDerived(deriveStepHoles(mesh.positions, faceIds, modelScaleToInches("step")));
    }, 0);
    return () => clearTimeout(timer);
  }, [active, needHoles, mesh]);

  const size = cachedSize ?? measured;
  const { dims, omittedHoles } = partDimensions({
    fileType,
    analysis: part.analysis ?? liveAnalysis,
    modelSize: size,
    thicknessIn: part.thickness_in ?? null,
    holes,
  });
  // STEP waits for its holes unless the file never arrives (then box only)
  const waiting = needHoles && !fileError;

  // STEP: write once the holes are known (box + holes together); STL: box only
  const writeCache = is3d && size !== null && (isStep ? !cachedHoles && holes !== null : !cachedSize);
  const written = useRef(false);
  useEffect(() => {
    if (!active || !writeCache || !size || written.current) return;
    written.current = true;
    cacheModelSizeAction(part.id, modelSizeCache(size, isStep ? holes : null)).catch(() => {
      written.current = false; // a miss just re-derives next time
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- size/holes are rebuilt each render; these gate it
  }, [active, writeCache, derived, measured, part.id]);

  return { dims: waiting ? null : dims, omittedHoles, error: dims === null && fileError };
}
