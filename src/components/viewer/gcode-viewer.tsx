"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { GizmoHelper, GizmoViewcube, OrbitControls } from "@react-three/drei";
import type { GcodeToolpath } from "@/services/gcode/gcode-parser";

interface Props {
  toolpath: GcodeToolpath;
  className?: string;
}

/** 3D toolpath preview: amber cutting moves, faded rapids, same controls as STL. */
export function GcodeViewer({ toolpath, className }: Props) {
  const { size } = toolpath.boundingBox;
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const camDist = maxDim * 1.8;

  return (
    <div className={`overflow-hidden rounded-lg border bg-card ${className ?? ""}`}>
      <Canvas
        camera={{
          position: [camDist, -camDist, camDist * 0.75],
          up: [0, 0, 1],
          fov: 45,
          near: maxDim / 100,
          far: maxDim * 20,
        }}
        className="touch-none"
      >
        <ToolpathLines toolpath={toolpath} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
        <GizmoHelper alignment="top-right" margin={[56, 56]}>
          <GizmoViewcube
            color="#f4f4f5"
            hoverColor="#fbbf24"
            textColor="#27272a"
            strokeColor="#71717a"
            faces={["Right", "Left", "Back", "Front", "Top", "Bottom"]}
          />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}

function ToolpathLines({ toolpath }: { toolpath: GcodeToolpath }) {
  const { cuts, rapids, center } = useMemo(() => {
    const cutPoints: number[] = [];
    const rapidPoints: number[] = [];
    for (const seg of toolpath.segments) {
      (seg.rapid ? rapidPoints : cutPoints).push(...seg.from, ...seg.to);
    }
    const make = (points: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(points), 3));
      return g;
    };
    const { min, max } = toolpath.boundingBox;
    return {
      cuts: make(cutPoints),
      rapids: make(rapidPoints),
      center: new THREE.Vector3(-(min.x + max.x) / 2, -(min.y + max.y) / 2, -(min.z + max.z) / 2),
    };
  }, [toolpath]);

  return (
    <group position={center}>
      <lineSegments geometry={cuts}>
        <lineBasicMaterial color="#d97706" />
      </lineSegments>
      <lineSegments geometry={rapids}>
        <lineBasicMaterial color="#a1a1aa" transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}
