import type { ModelFeatures } from "@/services/dimensions/model-features";

type V3 = [number, number, number];

/**
 * Can the "UNDIMENSIONED GEOMETRY PER CAD MODEL" note be dropped? Only when
 * every face is a recognized plane or cylinder and each is covered by what
 * the sheet dimensions: for turned parts, coaxial steps/bores and shoulders
 * perpendicular to the axis; for prismatic parts, a plain block (planes on
 * the bounding box) with holes. Fillets, chamfers, cones, angled faces → no.
 * (The caller separately confirms every callout was actually placed.)
 */
export function isComplete(f: ModelFeatures, bounds: { min: V3; max: V3 }): boolean {
  if (f.otherAreaFraction > 1e-3) return false;
  if (f.cylinders.some((c) => !c.full)) return false;
  const holesOk = f.holes.every((h) => h.thru || h.members.every((i) => f.cylinders[i].blind));
  if (!holesOk) return false;
  if (f.turned) {
    const a = f.turned.axis;
    const o = f.turned.origin;
    const perpendicular = f.planes.every((p) => Math.abs(p.normal.x * a.x + p.normal.y * a.y + p.normal.z * a.z) > 0.9999);
    const coaxialBosses = f.cylinders
      .filter((c) => c.kind === "boss")
      .every((c) => Math.hypot(c.origin.y - o.y, c.origin.z - o.z) < 1e-3 && Math.abs(c.axis.x) > 0.9999);
    return perpendicular && coaxialBosses;
  }
  if (f.cylinders.some((c) => c.kind === "boss")) return false;
  return f.planes.every((p) => {
    const n: V3 = [p.normal.x, p.normal.y, p.normal.z];
    const k = n.findIndex((c) => Math.abs(c) > 0.9999);
    if (k < 0) return false;
    const at = n[k] > 0 ? bounds.max[k] : -bounds.min[k];
    return Math.abs(p.offset - at) < 1e-3;
  });
}
