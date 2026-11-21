import type { MeshTopology } from "./mesh-topology";

export type V3 = [number, number, number];

/** Orthographic view: screen axes and viewing direction (into the screen). */
export interface ViewBasis {
  right: V3;
  up: V3;
  fwd: V3;
}

const s2 = Math.SQRT1_2;
const s3 = 1 / Math.sqrt(3);
const s6 = 1 / Math.sqrt(6);

/** Z-up model (the app's 3D viewer convention); front looks along +Y. */
export const VIEWS = {
  front: { right: [1, 0, 0], up: [0, 0, 1], fwd: [0, 1, 0] },
  top: { right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, -1] },
  right: { right: [0, 1, 0], up: [0, 0, 1], fwd: [-1, 0, 0] },
  /** from front-right-top */
  iso: { right: [s2, s2, 0], up: [-s6, s6, 2 * s6], fwd: [-s3, s3, -s3] },
} satisfies Record<string, ViewBasis>;

/** Visible edges of one view as 2-D segments (model inches, screen axes). */
export interface LineView {
  /** u0, v0, u1, v1 per segment */
  segs: number[];
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
  /** is this model point (inches) unoccluded in the view? */
  probe: (p: V3) => boolean;
}

const dot = (v: Float64Array, i: number, a: V3) => v[i * 3] * a[0] + v[i * 3 + 1] * a[1] + v[i * 3 + 2] * a[2];

/**
 * Hidden-line removal with a software depth buffer: rasterize every
 * triangle's depth, then walk each candidate edge (creases, boundaries,
 * and this view's silhouettes) and keep the runs not behind a surface.
 * Output is true vector geometry.
 */
export function lineView(
  topo: MeshTopology,
  basis: ViewBasis,
  resolution = 1600,
  parts: { edges: boolean; contours: boolean } = { edges: true, contours: true },
): LineView {
  const n = topo.verts.length / 3;
  const U = new Float64Array(n);
  const Vv = new Float64Array(n);
  const D = new Float64Array(n);
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < n; i++) {
    U[i] = dot(topo.verts, i, basis.right);
    Vv[i] = dot(topo.verts, i, basis.up);
    D[i] = dot(topo.verts, i, basis.fwd);
    minU = Math.min(minU, U[i]);
    maxU = Math.max(maxU, U[i]);
    minV = Math.min(minV, Vv[i]);
    maxV = Math.max(maxV, Vv[i]);
  }
  const span = Math.max(maxU - minU, maxV - minV, 1e-9);
  const px = span / resolution;
  const W = Math.ceil((maxU - minU) / px) + 3;
  const H = Math.ceil((maxV - minV) / px) + 3;
  const zbuf = new Float32Array(W * H).fill(Infinity);
  const gx = (u: number) => (u - minU) / px + 1;
  const gy = (v: number) => (v - minV) / px + 1;

  // depth buffer
  const triCount = topo.tris.length / 3;
  for (let t = 0; t < triCount; t++) {
    const a = topo.tris[t * 3], b = topo.tris[t * 3 + 1], c = topo.tris[t * 3 + 2];
    const x0 = gx(U[a]), y0 = gy(Vv[a]), x1 = gx(U[b]), y1 = gy(Vv[b]), x2 = gx(U[c]), y2 = gy(Vv[c]);
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-9) continue; // edge-on: occludes nothing
    const ix0 = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const ix1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
    const iy0 = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const iy1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let iy = iy0; iy <= iy1; iy++) {
      const py = iy + 0.5;
      for (let ix = ix0; ix <= ix1; ix++) {
        const pxc = ix + 0.5;
        const w0 = ((x1 - pxc) * (y2 - py) - (x2 - pxc) * (y1 - py)) / area;
        const w1 = ((x2 - pxc) * (y0 - py) - (x0 - pxc) * (y2 - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const z = w0 * D[a] + w1 * D[b] + w2 * D[c];
        const k = iy * W + ix;
        if (z < zbuf[k]) zbuf[k] = z;
      }
    }
  }

  const eps = 3 * px;
  /**
   * Is a point at depth d in front of the depth buffer? Model edges test
   * their own pixel, so edges hiding just behind an outline stay hidden.
   * Contours sit where their surface turns edge-on — its depth changes
   * steeply within a pixel — so they pass if any 3×3 neighbor clears.
   */
  const visibleAt = (u: number, v: number, d: number, lenient: boolean) => {
    const cx = Math.floor(gx(u)), cy = Math.floor(gy(v));
    const r = lenient ? 1 : 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) return true;
        if (d <= zbuf[y * W + x] + eps) return true;
      }
    }
    return false;
  };

  const segs: number[] = [];
  const seen = new Set<string>();
  const minRun = 2 * px;
  /**
   * Walk a 3-D segment (projected endpoints p, q) and keep its visible runs.
   * Model edges drop sub-2px slivers (occlusion noise); contour pieces tile
   * a curve and can be tiny, so `piece` keeps them whole.
   */
  const trace = (pu: number, pv: number, pd: number, qu: number, qv: number, qd: number, piece = false) => {
    const du = qu - pu, dv = qv - pv;
    const lenPx = Math.hypot(du, dv) / px;
    if (lenPx < (piece ? 0.05 : 0.5)) return; // seen end-on
    const steps = Math.max(2, Math.ceil(lenPx / 0.75));
    let runStart = -1;
    let lastVisible = 0;
    const flush = () => {
      if (runStart < 0) return;
      const s = runStart;
      runStart = -1;
      if (lastVisible <= s || (!piece && (lastVisible - s) * lenPx * px < minRun)) return;
      const seg = [pu + du * s, pv + dv * s, pu + du * lastVisible, pv + dv * lastVisible];
      const key = segKey(seg, px);
      if (seen.has(key)) return;
      seen.add(key);
      segs.push(...seg);
    };
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (visibleAt(pu + du * t, pv + dv * t, pd + (qd - pd) * t, piece)) {
        if (runStart < 0) runStart = t;
        lastVisible = t;
      } else flush();
    }
    flush();
  };

  // model edges: creases, open boundaries
  for (let e = 0; e < topo.edgeCount && parts.edges; e++) {
    if (!topo.edgeHard[e]) continue;
    const a = topo.edgeA[e], b = topo.edgeB[e];
    trace(U[a], Vv[a], D[a], U[b], Vv[b], D[b]);
  }

  // silhouettes of curved faces: where the smoothed normal turns edge-on,
  // interpolated across each triangle (no zig-zag along tessellation edges)
  const N = topo.cornerNormals;
  const [fx, fy, fz] = basis.fwd;
  const g = [0, 0, 0];
  const cross: number[] = [];
  for (let t = 0; t < triCount && parts.contours; t++) {
    for (let k = 0; k < 3; k++) {
      const o = (t * 3 + k) * 3;
      g[k] = N[o] * fx + N[o + 1] * fy + N[o + 2] * fz;
    }
    const pos = (g[0] >= 0 ? 1 : 0) + (g[1] >= 0 ? 1 : 0) + (g[2] >= 0 ? 1 : 0);
    if (pos === 0 || pos === 3) continue;
    cross.length = 0;
    for (let k = 0; k < 3; k++) {
      const k2 = (k + 1) % 3;
      if (g[k] >= 0 === g[k2] >= 0) continue;
      const a = topo.tris[t * 3 + k], b = topo.tris[t * 3 + k2];
      const s = g[k] / (g[k] - g[k2]);
      cross.push(U[a] + (U[b] - U[a]) * s, Vv[a] + (Vv[b] - Vv[a]) * s, D[a] + (D[b] - D[a]) * s);
    }
    if (cross.length === 6) trace(cross[0], cross[1], cross[2], cross[3], cross[4], cross[5], true);
  }
  const probe = (p: V3) =>
    visibleAt(
      p[0] * basis.right[0] + p[1] * basis.right[1] + p[2] * basis.right[2],
      p[0] * basis.up[0] + p[1] * basis.up[1] + p[2] * basis.up[2],
      p[0] * fx + p[1] * fy + p[2] * fz,
      false,
    );
  return { segs, minU, maxU, minV, maxV, probe };
}

function segKey(s: number[], px: number): string {
  const r = (v: number) => Math.round(v / px);
  const p = `${r(s[0])},${r(s[1])}`;
  const q = `${r(s[2])},${r(s[3])}`;
  return p < q ? `${p}|${q}` : `${q}|${p}`;
}
