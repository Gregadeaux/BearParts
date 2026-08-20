/**
 * Minimal STL parser (binary + ASCII) — no three.js dependency, pure and
 * isomorphic like the DXF services. Returns flat triangle positions ready
 * for a BufferGeometry; normals are recomputed by the viewer.
 */

export interface StlMesh {
  /** xyz triples, 9 floats per triangle */
  positions: Float32Array;
  triangleCount: number;
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
  };
}

export function parseStl(buffer: ArrayBuffer): StlMesh {
  const positions = isAsciiStl(buffer) ? parseAscii(buffer) : parseBinary(buffer);
  if (positions.length === 0) throw new Error("STL contains no triangles");
  return {
    positions,
    triangleCount: positions.length / 9,
    boundingBox: computeBBox(positions),
  };
}

function isAsciiStl(buffer: ArrayBuffer): boolean {
  const head = new TextDecoder().decode(buffer.slice(0, 5)).toLowerCase();
  if (head !== "solid") return false;
  // some binary files start with "solid" too — trust the binary size math over the header
  if (buffer.byteLength >= 84) {
    const count = new DataView(buffer).getUint32(80, true);
    if (84 + count * 50 === buffer.byteLength) return false;
  }
  return true;
}

function parseBinary(buffer: ArrayBuffer): Float32Array {
  if (buffer.byteLength < 84) throw new Error("Not a valid STL file");
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  const expected = 84 + count * 50;
  if (expected > buffer.byteLength) throw new Error("STL file is truncated");

  const positions = new Float32Array(count * 9);
  for (let i = 0; i < count; i++) {
    const base = 84 + i * 50 + 12; // skip the facet normal
    for (let v = 0; v < 9; v++) {
      positions[i * 9 + v] = view.getFloat32(base + v * 4, true);
    }
  }
  return positions;
}

function parseAscii(buffer: ArrayBuffer): Float32Array {
  const text = new TextDecoder().decode(buffer);
  const out: number[] = [];
  const vertexRe = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  let m: RegExpExecArray | null;
  while ((m = vertexRe.exec(text)) !== null) {
    out.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
  }
  if (out.length % 9 !== 0) out.length = out.length - (out.length % 9);
  return new Float32Array(out);
}

export function computeBBox(p: Float32Array): StlMesh["boundingBox"] {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (let i = 0; i < p.length; i += 3) {
    min.x = Math.min(min.x, p[i]);
    min.y = Math.min(min.y, p[i + 1]);
    min.z = Math.min(min.z, p[i + 2]);
    max.x = Math.max(max.x, p[i]);
    max.y = Math.max(max.y, p[i + 1]);
    max.z = Math.max(max.z, p[i + 2]);
  }
  return {
    min,
    max,
    size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z },
  };
}
