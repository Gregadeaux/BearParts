"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import type { BoreView } from "@/services/dimensions/bore-view";
import type { Vec3 } from "@/services/dimensions/figure-3d";

const ACCENT = "#2563eb";
const SEGMENTS = 40;

interface Props {
  view: BoreView;
  /** member centers, model units, relative to the model's bbox center */
  centers: Vec3[];
  /** ring radius, model units (already enlarged / floored for visibility) */
  radius: number;
  /** model units per screen px */
  unit: number;
}

/**
 * Every hole of the group ringed and filled, seen straight down its axis —
 * the 3D twin of the DXF hole highlight. Drawn over the model (no depth
 * test) so a hole is findable even from the far side.
 */
export function ModelBoreMarks({ view, centers, radius, unit }: Props) {
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...view.cameraDir)),
    [view.cameraDir],
  );
  const ring = (c: Vec3, r: number): Vec3[] =>
    Array.from({ length: SEGMENTS + 1 }, (_, k) => {
      const t = (2 * Math.PI * k) / SEGMENTS;
      const [cu, sw] = [Math.cos(t) * r, Math.sin(t) * r];
      return [0, 1, 2].map((i) => c[i] + view.rightVec[i] * cu + view.upVec[i] * sw) as Vec3;
    });
  const overlay = { depthTest: false, depthWrite: false, transparent: true } as const;

  return (
    <group renderOrder={10}>
      {centers.map((c, i) => (
        <group key={i}>
          <mesh position={c} quaternion={quaternion} renderOrder={10}>
            <circleGeometry args={[radius + 4 * unit, SEGMENTS]} />
            <meshBasicMaterial color={ACCENT} opacity={0.15} {...overlay} />
          </mesh>
          <mesh position={c} quaternion={quaternion} renderOrder={11}>
            <circleGeometry args={[radius, SEGMENTS]} />
            <meshBasicMaterial color={ACCENT} opacity={0.3} {...overlay} />
          </mesh>
          <Line points={ring(c, radius)} color={ACCENT} lineWidth={2.25} depthTest={false} renderOrder={12} />
        </group>
      ))}
    </group>
  );
}
