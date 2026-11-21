import type { ModelFeatures, ModelPlane } from "@/services/dimensions/model-features";

export interface TubeSection {
  /** uniform wall thickness, inches */
  wall: number;
  /** the inside faces (so completeness checks count them as dimensioned) */
  inner: ModelPlane[];
}

/**
 * A rectangular tube drawn along X: every face is an end face (normal ±X)
 * or parallel to X, and each outer side face has an inside face parallel
 * to it at one common wall thickness. Null for anything else.
 */
export function rectTube(f: ModelFeatures, min: [number, number, number], max: [number, number, number]): TubeSection | null {
  if (f.otherAreaFraction > 1e-3 || f.cylinders.some((c) => c.kind === "boss")) return null;
  const n = (p: ModelPlane): [number, number, number] => [p.normal.x, p.normal.y, p.normal.z];
  const along = (p: ModelPlane, k: number) => Math.abs(n(p)[k]) > 0.9999;
  if (!f.planes.every((p) => along(p, 0) || Math.abs(p.normal.x) < 1e-4)) return null;
  const section = Math.min(max[1] - min[1], max[2] - min[2]);
  const inner: ModelPlane[] = [];
  let wall: number | null = null;
  for (const k of [1, 2]) {
    for (const sign of [1, -1]) {
      // outer face: normal ±k at the bounding box; inner: facing back at depth t
      const outerAt = sign > 0 ? max[k] : -min[k];
      const outer = f.planes.find((p) => along(p, k) && Math.sign(n(p)[k]) === sign && Math.abs(p.offset - outerAt) < 1e-3);
      if (!outer) return null;
      const cand = f.planes
        .filter((p) => along(p, k) && Math.sign(n(p)[k]) === -sign)
        .map((p) => ({ p, t: outerAt + p.offset }))
        .filter(({ t }) => t > 1e-3 && t < section * 0.35)
        .sort((a, b) => a.t - b.t)[0];
      if (!cand) return null;
      if (wall !== null && Math.abs(cand.t - wall) > 1e-3) return null;
      wall ??= cand.t;
      inner.push(cand.p);
    }
  }
  return wall === null ? null : { wall, inner };
}
