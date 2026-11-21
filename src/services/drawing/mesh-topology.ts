/**
 * Welded triangle-mesh topology for line drawings: shared edges, face
 * normals, and which edges are creases (real model edges) vs smooth
 * tessellation seams. Pure; positions are 9 floats per triangle.
 */

export interface MeshTopology {
  /** welded vertex positions, xyz */
  verts: Float64Array;
  /** welded vertex indices, 3 per triangle */
  tris: Uint32Array;
  /** edge endpoints (vertex indices) */
  edgeA: Uint32Array;
  edgeB: Uint32Array;
  /** adjacent triangles; edgeT1 = -1 on an open boundary */
  edgeT0: Int32Array;
  edgeT1: Int32Array;
  /** 1 = always drawn: crease, boundary, or non-manifold edge */
  edgeHard: Uint8Array;
  edgeCount: number;
  /**
   * Smoothed normal per triangle corner (xyz × 3 per triangle): averaged
   * over neighbors within the crease angle, so curved faces read as smooth
   * and silhouettes can be interpolated across them.
   */
  cornerNormals: Float32Array;
}

/**
 * @param creaseDeg dihedral angle above which an edge is a visible model
 *   edge. Tessellation of curved faces stays below it, tangent face
 *   boundaries (fillets) stay below it — matching drafting practice of not
 *   drawing tangent edges.
 * @param faceIds B-rep face per triangle (STEP), -1 = unknown. Edges inside
 *   one face are never model edges, however its triangulation zig-zags.
 */
export function buildTopology(
  positions: ArrayLike<number>,
  creaseDeg = 30,
  faceIds: ArrayLike<number> | null = null,
): MeshTopology {
  const sameFace = (s: number, t: number) => faceIds !== null && faceIds[s] >= 0 && faceIds[s] === faceIds[t];
  const triCount = Math.floor(positions.length / 9);
  let ext = 0;
  for (let i = 0; i < positions.length; i++) ext = Math.max(ext, Math.abs(positions[i]));
  const q = Math.max(ext * 1e-6, 1e-9);

  // weld coincident vertices
  const index = new Map<string, number>();
  const verts: number[] = [];
  const tris = new Uint32Array(triCount * 3);
  for (let i = 0; i < triCount * 3; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const key = `${Math.round(x / q)},${Math.round(y / q)},${Math.round(z / q)}`;
    let v = index.get(key);
    if (v === undefined) {
      v = verts.length / 3;
      verts.push(x, y, z);
      index.set(key, v);
    }
    tris[i] = v;
  }
  const V = new Float64Array(verts);

  const normals = new Float64Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    const [a, b, c] = [tris[t * 3], tris[t * 3 + 1], tris[t * 3 + 2]];
    const ux = V[b * 3] - V[a * 3], uy = V[b * 3 + 1] - V[a * 3 + 1], uz = V[b * 3 + 2] - V[a * 3 + 2];
    const vx = V[c * 3] - V[a * 3], vy = V[c * 3 + 1] - V[a * 3 + 1], vz = V[c * 3 + 2] - V[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 0) {
      normals[t * 3] = nx / len;
      normals[t * 3 + 1] = ny / len;
      normals[t * 3 + 2] = nz / len;
    }
  }

  const nVerts = V.length / 3;
  const edgeIndex = new Map<number, number>();
  const ea: number[] = [], eb: number[] = [], t0: number[] = [], t1: number[] = [], hard: number[] = [];
  const cosCrease = Math.cos((creaseDeg * Math.PI) / 180);
  for (let t = 0; t < triCount; t++) {
    if (normals[t * 3] === 0 && normals[t * 3 + 1] === 0 && normals[t * 3 + 2] === 0) continue;
    for (let k = 0; k < 3; k++) {
      const p = tris[t * 3 + k];
      const r = tris[t * 3 + ((k + 1) % 3)];
      if (p === r) continue;
      const [a, b] = p < r ? [p, r] : [r, p];
      const key = a * nVerts + b;
      const e = edgeIndex.get(key);
      if (e === undefined) {
        edgeIndex.set(key, ea.length);
        ea.push(a);
        eb.push(b);
        t0.push(t);
        t1.push(-1);
        hard.push(1);
      } else if (t1[e] === -1) {
        t1[e] = t;
        const s = t0[e];
        // |dot| so inconsistent winding never fakes a crease on a flat face
        const dot = Math.abs(
          normals[s * 3] * normals[t * 3] + normals[s * 3 + 1] * normals[t * 3 + 1] + normals[s * 3 + 2] * normals[t * 3 + 2],
        );
        hard[e] = dot < cosCrease && !sameFace(s, t) ? 1 : 0;
      } else {
        hard[e] = 1; // non-manifold
      }
    }
  }

  return {
    verts: V,
    tris,
    edgeA: Uint32Array.from(ea),
    edgeB: Uint32Array.from(eb),
    edgeT0: Int32Array.from(t0),
    edgeT1: Int32Array.from(t1),
    edgeHard: Uint8Array.from(hard),
    edgeCount: ea.length,
    cornerNormals: smoothCornerNormals(tris, normals, V, nVerts, cosCrease, sameFace),
  };
}

/** Area-weighted corner normals: smooth within a face and across sub-crease angles. */
function smoothCornerNormals(
  tris: Uint32Array,
  normals: Float64Array,
  V: Float64Array,
  nVerts: number,
  cosCrease: number,
  sameFace: (s: number, t: number) => boolean,
): Float32Array {
  const triCount = tris.length / 3;
  const area = new Float64Array(triCount);
  for (let t = 0; t < triCount; t++) {
    const [a, b, c] = [tris[t * 3], tris[t * 3 + 1], tris[t * 3 + 2]];
    const ux = V[b * 3] - V[a * 3], uy = V[b * 3 + 1] - V[a * 3 + 1], uz = V[b * 3 + 2] - V[a * 3 + 2];
    const vx = V[c * 3] - V[a * 3], vy = V[c * 3 + 1] - V[a * 3 + 1], vz = V[c * 3 + 2] - V[a * 3 + 2];
    area[t] = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  }
  // vertex → incident triangles (CSR)
  const start = new Uint32Array(nVerts + 1);
  for (let i = 0; i < tris.length; i++) start[tris[i] + 1]++;
  for (let v = 0; v < nVerts; v++) start[v + 1] += start[v];
  const fill = start.slice(0, nVerts);
  const incident = new Uint32Array(tris.length);
  for (let i = 0; i < tris.length; i++) incident[fill[tris[i]]++] = Math.floor(i / 3);

  const out = new Float32Array(tris.length * 3);
  for (let t = 0; t < triCount; t++) {
    const nx = normals[t * 3], ny = normals[t * 3 + 1], nz = normals[t * 3 + 2];
    for (let k = 0; k < 3; k++) {
      const v = tris[t * 3 + k];
      let sx = 0, sy = 0, sz = 0;
      for (let j = start[v]; j < start[v + 1]; j++) {
        const f = incident[j];
        const fx = normals[f * 3], fy = normals[f * 3 + 1], fz = normals[f * 3 + 2];
        if (fx * nx + fy * ny + fz * nz < cosCrease && !sameFace(f, t)) continue;
        sx += fx * area[f];
        sy += fy * area[f];
        sz += fz * area[f];
      }
      const len = Math.hypot(sx, sy, sz) || 1;
      const o = (t * 3 + k) * 3;
      out[o] = sx / len;
      out[o + 1] = sy / len;
      out[o + 2] = sz / len;
    }
  }
  return out;
}
