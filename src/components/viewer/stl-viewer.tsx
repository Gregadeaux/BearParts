"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { GizmoHelper, GizmoViewcube, OrbitControls } from "@react-three/drei";
import type { StlMesh } from "@/services/stl/stl-parser";

interface Props {
  mesh: StlMesh;
  className?: string;
}

/** Interactive 3D viewer: orbit (drag), pan (two-finger/right drag), pinch zoom. */
export function StlViewer({ mesh, className }: Props) {
  const maxDim = Math.max(mesh.boundingBox.size.x, mesh.boundingBox.size.y, mesh.boundingBox.size.z, 1);
  const camDist = maxDim * 1.8;

  return (
    <div className={`overflow-hidden rounded-lg border bg-card ${className ?? ""}`}>
      <Canvas
        camera={{
          position: [camDist, -camDist, camDist * 0.75],
          up: [0, 0, 1], // STLs are Z-up
          fov: 45,
          near: maxDim / 100,
          far: maxDim * 20,
        }}
        className="touch-none"
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[camDist, -camDist, camDist * 2]} intensity={1.2} />
        <directionalLight position={[-camDist, camDist, -camDist]} intensity={0.4} />
        <StlModel mesh={mesh} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
        {/* CAD-style orientation cube — click faces/edges/corners to snap the view */}
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

function StlModel({ mesh }: { mesh: StlMesh }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    g.computeVertexNormals();
    g.center();
    return g;
  }, [mesh]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#d97706" roughness={0.55} metalness={0.05} flatShading />
    </mesh>
  );
}
