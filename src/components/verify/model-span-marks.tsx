"use client";

import { Line } from "@react-three/drei";
import type { BoreView } from "@/services/dimensions/bore-view";
import type { Vec3 } from "@/services/dimensions/figure-3d";
import { ModelBoreMarks } from "./model-bore-marks";

const ACCENT = "#2563eb";

interface Props {
  view: BoreView;
  /** spacing: first hole center; edge: the datum-edge point (model units, bbox-centered) */
  a: Vec3;
  /** spacing: the adjacent hole center; edge: the hole center */
  b: Vec3;
  ends: "holes" | "edge";
  /** the datum edge, drawn bold (edge distance only) */
  edge: [Vec3, Vec3] | null;
  /** ring radius, model units */
  radius: number;
  /** model units per screen px */
  unit: number;
}

/**
 * A pattern distance in the down-axis view: the hole(s) ringed, the datum
 * edge bold, a double arrow between the centers (or edge → center). Drawn
 * over the model. No numbers — entry is blind.
 */
export function ModelSpanMarks({ view, a, b, ends, edge, radius, unit }: Props) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
  const u = [0, 1, 2].map((i) => (b[i] - a[i]) / len);
  // in the screen plane, perpendicular to the arrow
  const p = [
    view.cameraDir[1] * u[2] - view.cameraDir[2] * u[1],
    view.cameraDir[2] * u[0] - view.cameraDir[0] * u[2],
    view.cameraDir[0] * u[1] - view.cameraDir[1] * u[0],
  ];
  const chevron = (tip: Vec3, inward: 1 | -1): Vec3[] => {
    const arm = (s: number) => [0, 1, 2].map((i) => tip[i] + inward * u[i] * 8 * unit + s * p[i] * 3.5 * unit) as Vec3;
    return [tip, arm(1), tip, arm(-1)];
  };
  const overlay = { depthTest: false, renderOrder: 13, color: ACCENT } as const;

  return (
    <group>
      {edge && <Line points={edge} lineWidth={4} {...overlay} />}
      <ModelBoreMarks view={view} centers={ends === "holes" ? [a, b] : [b]} radius={radius} unit={unit} />
      <Line points={[a, b]} lineWidth={2} {...overlay} />
      <Line points={[...chevron(a, 1), ...chevron(b, -1)]} segments lineWidth={2} {...overlay} />
    </group>
  );
}
