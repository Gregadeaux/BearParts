"use client";

import { Line } from "@react-three/drei";
import { modelDimensionLine, type Axis, type ModelView, type Vec3 } from "@/services/dimensions/figure-3d";

const ACCENT = "#2563eb";
const AXES: Axis[] = ["x", "y", "z"];

interface Props {
  size: { x: number; y: number; z: number };
  axis: Axis;
  view: ModelView;
  /** model units per screen px (orthographic) */
  unit: number;
  /** close-ups: extension lines run in to this across-axis coordinate */
  extendTo?: number;
}

/**
 * Dimension line + extension lines + arrow chevrons, drawn over (never hidden
 * by) the model. No value label — entry is blind.
 */
export function ModelDimensionLine({ size, axis, view, unit, extendTo }: Props) {
  const d = modelDimensionLine(size, axis, view, 14 * unit, 5 * unit, extendTo);
  const along = AXES.indexOf(axis);
  const across = AXES.indexOf(view.dimOnScreen === "horizontal" ? view.up : view.horizontal);
  const chevron = (tip: Vec3, inward: 1 | -1): Vec3[] => {
    const arm = (spread: number): Vec3 => {
      const p = [...tip] as Vec3;
      p[along] += inward * 9 * unit;
      p[across] += spread * 4 * unit;
      return p;
    };
    return [tip, arm(1), tip, arm(-1)];
  };
  const overlay = { depthTest: false, renderOrder: 10, color: ACCENT } as const;

  return (
    <group>
      <Line points={[...d.extA, ...d.extB]} segments lineWidth={1.25} {...overlay} />
      <Line points={[d.a, d.b]} lineWidth={3} {...overlay} />
      <Line points={[...chevron(d.a, 1), ...chevron(d.b, -1)]} segments lineWidth={3} {...overlay} />
    </group>
  );
}
