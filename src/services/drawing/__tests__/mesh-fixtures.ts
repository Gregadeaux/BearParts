/**
 * Exact test meshes with B-rep face ids, standing in for occt output.
 * Units are whatever the caller uses (tests use inches).
 */

export interface FaceMesh {
  positions: number[];
  faceIds: number[];
}

type P3 = [number, number, number];

function tri(m: FaceMesh, face: number, a: P3, b: P3, c: P3, outward: P3) {
  const n = cross(sub(b, a), sub(c, a));
  const [p, q] = n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2] >= 0 ? [b, c] : [c, b];
  m.positions.push(...a, ...p, ...q);
  m.faceIds.push(face);
}

const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Revolve a closed (x, r) profile, counter-clockwise with material on the
 * left, about the X axis. One face per profile edge.
 */
export function revolve(profile: [number, number][], segments = 48): FaceMesh {
  const m: FaceMesh = { positions: [], faceIds: [] };
  profile.forEach(([x0, r0], e) => {
    const [x1, r1] = profile[(e + 1) % profile.length];
    // outward normal of the edge in the profile plane: right of travel
    const nx = r1 - r0, nr = -(x1 - x0);
    for (let k = 0; k < segments; k++) {
      const t0 = (2 * Math.PI * k) / segments, t1 = (2 * Math.PI * (k + 1)) / segments;
      const P = (x: number, r: number, t: number): P3 => [x, r * Math.cos(t), r * Math.sin(t)];
      const tm = (t0 + t1) / 2;
      const out: P3 = [nx, nr * Math.cos(tm), nr * Math.sin(tm)];
      if (r0 > 0) tri(m, e, P(x0, r0, t0), P(x1, r1, t0), P(x0, r0, t1), out);
      if (r1 > 0) tri(m, e, P(x1, r1, t0), P(x1, r1, t1), P(x0, r0, t1), out);
    }
  });
  return m;
}

/**
 * One planar face built from rectangular cells between grid lines (a, b in
 * the face's own 2-D frame), each cell edge sampled alike so neighboring
 * faces weld. `hole(i, j)` → diameter of a hole centered in that cell.
 * Returns the hole-rim points so walls can be stitched to them.
 */
function cellFace(
  m: FaceMesh, face: number, P: (a: number, b: number) => P3, normal: P3,
  la: number[], lb: number[], include: (i: number, j: number) => boolean,
  hole: (i: number, j: number) => number | null, perSide: number,
): Map<string, { rim: P3[]; center: P3 }> {
  const rims = new Map<string, { rim: P3[]; center: P3 }>();
  for (let i = 0; i + 1 < la.length; i++) {
    for (let j = 0; j + 1 < lb.length; j++) {
      if (!include(i, j)) continue;
      const [a0, a1, b0, b1] = [la[i], la[i + 1], lb[j], lb[j + 1]];
      const corners: [number, number][] = [[a0, b0], [a1, b0], [a1, b1], [a0, b1]];
      const ring: [number, number][] = [];
      for (let s = 0; s < 4; s++) {
        const [p, q] = [corners[s], corners[(s + 1) % 4]];
        for (let k = 0; k < perSide; k++) ring.push([p[0] + ((q[0] - p[0]) * k) / perSide, p[1] + ((q[1] - p[1]) * k) / perSide]);
      }
      const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
      const d = hole(i, j);
      const rim: P3[] = [];
      for (let k = 0; k < ring.length; k++) {
        const [p, q] = [ring[k], ring[(k + 1) % ring.length]];
        if (d === null) {
          tri(m, face, P(ca, cb), P(p[0], p[1]), P(q[0], q[1]), normal);
          continue;
        }
        const onCircle = (r: [number, number]): P3 => {
          const ang = Math.atan2(r[1] - cb, r[0] - ca);
          return P(ca + (d / 2) * Math.cos(ang), cb + (d / 2) * Math.sin(ang));
        };
        tri(m, face, P(p[0], p[1]), P(q[0], q[1]), onCircle(q), normal);
        tri(m, face, P(p[0], p[1]), onCircle(q), onCircle(p), normal);
        rim.push(onCircle(p));
      }
      if (d !== null) rims.set(`${i},${j}`, { rim, center: P(ca, cb) });
    }
  }
  return rims;
}

/** Hole wall between two rims (same sampling); outward normal points at the axis. */
function holeWall(m: FaceMesh, face: number, outer: P3[], inner: P3[], center: P3, axis: P3) {
  for (let k = 0; k < outer.length; k++) {
    const k2 = (k + 1) % outer.length;
    const d = sub(center, outer[k]);
    const along = d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2];
    const toAxis: P3 = [d[0] - axis[0] * along, d[1] - axis[1] * along, d[2] - axis[2] * along];
    tri(m, face, outer[k], outer[k2], inner[k2], toAxis);
    tri(m, face, outer[k], inner[k2], inner[k], toAxis);
  }
}

/**
 * Rectangular tube along X (L × W × H, wall t). Grid lines `gx` (0..L),
 * `gy` (0, t, …, W−t, W), `gz` (0, t, …, H−t, H). Holes sit at cell
 * centers: `wide` on the z faces (top only, or through both walls), `narrow`
 * on the y faces.
 */
export function holedTube(
  L: number, W: number, H: number, t: number, gx: number[], gy: number[], gz: number[],
  wide: { cells: [number, number][]; d: number; both: boolean } | null,
  narrow: { cells: [number, number][]; d: number; both: boolean } | null, perSide = 4,
): FaceMesh {
  const m: FaceMesh = { positions: [], faceIds: [] };
  let id = 0;
  const has = (set: [number, number][] | undefined, i: number, j: number) => Boolean(set?.some(([a, b]) => a === i && b === j));
  const inside = (lines: number[], j: number, lo: number, hi: number) => lines[j] >= lo - 1e-9 && lines[j + 1] <= hi + 1e-9;
  // z faces (wide): outer/inner, top and bottom
  for (const top of [true, false]) {
    const holeOn = (i: number, j: number) => (wide && has(wide.cells, i, j) && (top || wide.both) ? wide.d : null);
    const zo = top ? H : 0, zi = top ? H - t : t, n = top ? 1 : -1;
    const outer = cellFace(m, id++, (a, b) => [a, b, zo], [0, 0, n], gx, gy, () => true, holeOn, perSide);
    const inner = cellFace(m, id++, (a, b) => [a, b, zi], [0, 0, -n], gx, gy, (_i, j) => inside(gy, j, t, W - t), holeOn, perSide);
    for (const [key, o] of outer) holeWall(m, id++, o.rim, inner.get(key)!.rim, o.center, [0, 0, 1]);
  }
  // y faces (narrow)
  for (const far of [true, false]) {
    const holeOn = (i: number, j: number) => (narrow && has(narrow.cells, i, j) && (far || narrow.both) ? narrow.d : null);
    const yo = far ? W : 0, yi = far ? W - t : t, n = far ? 1 : -1;
    const outer = cellFace(m, id++, (a, b) => [a, yo, b], [0, n, 0], gx, gz, () => true, holeOn, perSide);
    const inner = cellFace(m, id++, (a, b) => [a, yi, b], [0, -n, 0], gx, gz, (_i, j) => inside(gz, j, t, H - t), holeOn, perSide);
    for (const [key, o] of outer) holeWall(m, id++, o.rim, inner.get(key)!.rim, o.center, [0, 1, 0]);
  }
  // end rings
  for (const end of [0, L]) {
    const ring = (i: number, j: number) => !(inside(gy, i, t, W - t) && inside(gz, j, t, H - t));
    cellFace(m, id++, (a, b) => [end, a, b], [end === 0 ? -1 : 1, 0, 0], gy, gz, ring, () => null, perSide);
  }
  return m;
}

/**
 * Rectangular plate (W × H × T, lying in XY, Z up) on a grid of square
 * cells; holes `[cx, cy, d]` must sit at cell centers. Every cell edge is
 * sampled alike so faces weld without T-junctions.
 */
export function holedPlate(W: number, H: number, T: number, cell: number, holes: [number, number, number][], perSide = 6): FaceMesh {
  const m: FaceMesh = { positions: [], faceIds: [] };
  const nx = Math.round(W / cell), ny = Math.round(H / cell);
  const ring = (cx: number, cy: number): [number, number][] => {
    const h = cell / 2, pts: [number, number][] = [];
    const corners: [number, number][] = [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]];
    for (let s = 0; s < 4; s++) {
      const [a, b] = [corners[s], corners[(s + 1) % 4]];
      for (let k = 0; k < perSide; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / perSide, a[1] + ((b[1] - a[1]) * k) / perSide]);
    }
    return pts;
  };
  let face = 6;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const cx = (i + 0.5) * cell, cy = (j + 0.5) * cell;
      const sq = ring(cx, cy);
      const hole = holes.find(([hx, hy]) => Math.abs(hx - cx) < 1e-9 && Math.abs(hy - cy) < 1e-9);
      for (const [z, f, up] of [[T, 0, 1], [0, 1, -1]] as const) {
        for (let k = 0; k < sq.length; k++) {
          const a = sq[k], b = sq[(k + 1) % sq.length];
          if (!hole) tri(m, f, [cx, cy, z], [a[0], a[1], z], [b[0], b[1], z], [0, 0, up]);
          else {
            // circle point "under" each square point, same angle ordering
            const c = (p: [number, number]): P3 => {
              const ang = Math.atan2(p[1] - cy, p[0] - cx);
              return [cx + (hole[2] / 2) * Math.cos(ang), cy + (hole[2] / 2) * Math.sin(ang), z];
            };
            tri(m, f, [a[0], a[1], z], [b[0], b[1], z], c(b), [0, 0, up]);
            tri(m, f, [a[0], a[1], z], c(b), c(a), [0, 0, up]);
          }
        }
      }
      if (hole) {
        const r = hole[2] / 2;
        const wall = face++;
        for (let k = 0; k < sq.length; k++) {
          const a = Math.atan2(sq[k][1] - cy, sq[k][0] - cx);
          const b = Math.atan2(sq[(k + 1) % sq.length][1] - cy, sq[(k + 1) % sq.length][0] - cx);
          const p = (t: number, z: number): P3 => [cx + r * Math.cos(t), cy + r * Math.sin(t), z];
          const inward: P3 = [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0];
          tri(m, wall, p(a, 0), p(b, 0), p(b, T), inward);
          tri(m, wall, p(a, 0), p(b, T), p(a, T), inward);
        }
      }
      // side walls on the plate boundary, sampled like the cell edges
      const edges: [number, [number, number], [number, number], P3][] = [];
      if (j === 0) edges.push([2, [cx - cell / 2, cy - cell / 2], [cx + cell / 2, cy - cell / 2], [0, -1, 0]]);
      if (j === ny - 1) edges.push([3, [cx - cell / 2, cy + cell / 2], [cx + cell / 2, cy + cell / 2], [0, 1, 0]]);
      if (i === 0) edges.push([4, [cx - cell / 2, cy - cell / 2], [cx - cell / 2, cy + cell / 2], [-1, 0, 0]]);
      if (i === nx - 1) edges.push([5, [cx + cell / 2, cy - cell / 2], [cx + cell / 2, cy + cell / 2], [1, 0, 0]]);
      for (const [f, a, b, out] of edges) {
        for (let k = 0; k < perSide; k++) {
          const p = (t: number, z: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z];
          const t0 = k / perSide, t1 = (k + 1) / perSide;
          tri(m, f, p(t0, 0), p(t1, 0), p(t1, T), out);
          tri(m, f, p(t0, 0), p(t1, T), p(t0, T), out);
        }
      }
    }
  }
  return m;
}
