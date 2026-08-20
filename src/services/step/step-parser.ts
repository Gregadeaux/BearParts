/**
 * STEP → triangle mesh via occt-import-js (OpenCascade compiled to WASM).
 * Output matches the STL parser's shape so the STL viewer renders it as-is.
 * Browser-only: the ~7 MB wasm is served from /occt-import-js.wasm (copied
 * out of node_modules by the postinstall script).
 */

import type { OcctModule } from "occt-import-js";
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
  const result = occt.ReadStepFile(new Uint8Array(buffer), null);
  if (!result.success || result.meshes.length === 0) {
    throw new Error("Could not read this STEP file");
  }

  // flatten every indexed mesh into 9-floats-per-triangle positions
  let indexTotal = 0;
  for (const mesh of result.meshes) indexTotal += mesh.index.array.length;
  const positions = new Float32Array(indexTotal * 3);

  let out = 0;
  for (const mesh of result.meshes) {
    const pos = mesh.attributes.position.array;
    for (const vertexIndex of mesh.index.array) {
      positions[out++] = pos[vertexIndex * 3];
      positions[out++] = pos[vertexIndex * 3 + 1];
      positions[out++] = pos[vertexIndex * 3 + 2];
    }
  }

  if (positions.length === 0) throw new Error("STEP file contains no geometry");
  return {
    positions,
    triangleCount: positions.length / 9,
    boundingBox: computeBBox(positions),
  };
}
