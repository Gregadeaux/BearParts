import type { OcctModule, OcctResult } from "occt-import-js";

/**
 * Tessellation for drawings: finer than the viewer's defaults (0.5 rad →
 * a 13-sided "circle") so holes and fillets draw round (~31 sides), while
 * facet-to-facet angles stay well under the 30° crease threshold. Output
 * stays in occt's default MILLIMETERS — inch conversion happens in one
 * place (modelScaleToInches) for drawing and verification alike.
 */
export const STEP_DRAWING_PARAMS = {
  linearDeflectionType: "bounding_box_ratio",
  linearDeflection: 0.001,
  angularDeflection: 0.2,
} as const;

export interface StepMesh {
  /** 9 floats per triangle, millimeters */
  positions: Float32Array;
  /** B-rep face each triangle came from (unique across the model) */
  faceIds: Int32Array;
}

type FaceRange = { first: number; last: number };

/**
 * Flatten occt's indexed meshes into triangle soup, keeping which B-rep
 * face every triangle belongs to — real model edges are face boundaries.
 */
export function flattenOcct(result: OcctResult): StepMesh {
  if (!result.success || result.meshes.length === 0) throw new Error("Could not read this STEP file");
  let total = 0;
  for (const m of result.meshes) total += m.index.array.length;
  const positions = new Float32Array(total * 3);
  const faceIds = new Int32Array(total / 3);
  let o = 0;
  let tri = 0;
  let nextFace = 0;
  for (const m of result.meshes) {
    const pos = m.attributes.position.array;
    const idx = m.index.array;
    const meshTris = idx.length / 3;
    const local = new Int32Array(meshTris).fill(-1);
    const faces = (m as { brep_faces?: FaceRange[] }).brep_faces ?? [];
    for (const f of faces) {
      const id = nextFace++;
      for (let t = Math.max(0, f.first); t <= Math.min(meshTris - 1, f.last); t++) local[t] = id;
    }
    for (let t = 0; t < meshTris; t++) {
      for (let k = 0; k < 3; k++) {
        const vi = idx[t * 3 + k];
        positions[o++] = pos[vi * 3];
        positions[o++] = pos[vi * 3 + 1];
        positions[o++] = pos[vi * 3 + 2];
      }
      faceIds[tri++] = local[t]; // -1: no face record, fall back to dihedral angle
    }
  }
  if (positions.length === 0) throw new Error("STEP file contains no geometry");
  return { positions, faceIds };
}

let occt: Promise<OcctModule> | null = null;

/** Browser-only: the wasm is served from /occt-import-js.wasm. */
export async function stepMeshForDrawing(buffer: ArrayBuffer): Promise<StepMesh> {
  occt ??= import("occt-import-js").then((m) => m.default({ locateFile: (f) => `/${f}` }));
  const mod = await occt;
  return flattenOcct(mod.ReadStepFile(new Uint8Array(buffer), STEP_DRAWING_PARAMS));
}
