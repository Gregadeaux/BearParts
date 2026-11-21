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
