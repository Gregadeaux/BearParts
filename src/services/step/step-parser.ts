/**
 * STEP → triangle mesh via occt-import-js (OpenCascade compiled to WASM).
 * Output matches the STL parser's shape so the STL viewer renders it as-is,
 * plus the B-rep face id of every triangle (Verify's hole recognition uses
 * it, so the page never parses the file twice).
 * Browser-only: the ~7 MB wasm is served from /occt-import-js.wasm (copied
 * out of node_modules by the postinstall script).
 */

import type { OcctModule } from "occt-import-js";
import { flattenOcct } from "@/services/drawing/step-mesh";
import { computeBBox, type StlMesh } from "../stl/stl-parser";

let occtPromise: Promise<OcctModule> | null = null;

function loadOcct(): Promise<OcctModule> {
  occtPromise ??= import("occt-import-js").then((m) =>
    m.default({ locateFile: (file) => `/${file}` }),
  );
  return occtPromise;
}

export async function parseStep(buffer: ArrayBuffer): Promise<StlMesh> {
  const occt = await loadOcct();
  // viewer tessellation (occt defaults); same flattening the drawing uses
  const { positions, faceIds } = flattenOcct(occt.ReadStepFile(new Uint8Array(buffer), null));
  return {
    positions,
    faceIds,
    triangleCount: positions.length / 9,
    boundingBox: computeBBox(positions),
  };
}
