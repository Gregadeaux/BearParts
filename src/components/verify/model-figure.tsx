"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { StlMesh } from "@/services/stl/stl-parser";
import type { KeyDimensionFeature } from "@/services/dimensions/key-dimensions";
import { holeRingRadius } from "@/services/dimensions/figure";
import { modelFraming, modelView, type Axis, type Vec3 } from "@/services/dimensions/figure-3d";
import { boreView } from "@/services/dimensions/bore-view";
import { useElementSize } from "./use-element-size";
import { ModelDimensionLine } from "./model-dimension-line";
import { ModelBoreMarks } from "./model-bore-marks";

const PAD_PX = 30;
const AXIS_INDEX: Record<Axis, number> = { x: 0, y: 1, z: 2 };

interface Props {
  mesh: StlMesh;
  /** what to call out; extent → dimension line, bores → ringed holes, none → part only */
  feature?: KeyDimensionFeature;
  /** inches per raw mesh unit (bore centers/diameters are cached in inches) */
  inchesPerUnit: number;
}

/**
 * The 3D model with the current dimension called out. Orthographic and
 * orbitable. Extents: a true-length dimension line, the camera on the
 * biggest face containing the axis (close-up when it'd be a sliver). Holes:
 * straight down the hole axis, the group ringed, the rest of the part
 * lighter. Loaded lazily (three.js) for STEP/STL parts only.
 */
export function ModelFigure({ mesh, feature, inchesPerUnit }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useElementSize(ref, { width: 340, height: 144 });
  const size = mesh.boundingBox.size;
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  const fitZoom = (w: number, h: number) =>
    Math.max(Math.min((px.width - 2 * PAD_PX) / w, (px.height - 2 * PAD_PX) / h), 1e-6);

  const bores = feature?.type === "bores" ? feature : null;
  const axis = feature?.type === "extent" ? feature.axis : null;
  // extents (or nothing to point at: frame the biggest face)
  const viewAxis = axis ?? smallestAxis(size);
  const view = modelView(size, viewAxis);
  const extentShot = axis
    ? modelFraming(size, axis, view, px, PAD_PX)
    : modelFraming(size, viewAxis, { ...view, dimOnScreen: "horizontal" }, px, PAD_PX);
  // holes: straight down their axis
  const bore = bores ? boreView(size, bores.axis) : null;
  const zoom = bore ? fitZoom(bore.width, bore.height) : extentShot.zoom;
  const target: Vec3 = bore ? [0, 0, 0] : extentShot.target;

  // own copy: the page's viewer centers its geometry in place on the shared array
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions.slice(), 3));
    g.computeVertexNormals();
    g.center();
    return g;
  }, [mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const dir = bore ? bore.cameraDir : view.cameraDir;
  return (
    <div ref={ref} className="h-full w-full">
      <Canvas
        orthographic
        frameloop="demand"
        camera={{ near: -maxDim * 10, far: maxDim * 10, zoom }}
        className="touch-none"
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={dir.map((v) => v * maxDim * 2) as Vec3} intensity={1.1} />
        <mesh geometry={geometry}>
          {/* lighter part while holes are ringed, so the rings own the picture */}
          <meshStandardMaterial color={bore ? "#e2e2e6" : "#c4c4cc"} roughness={0.6} metalness={0.05} flatShading />
        </mesh>
        {axis && (
          <ModelDimensionLine
            size={size}
            axis={axis}
            view={view}
            unit={1 / zoom}
            // close-up of a rounded/chamfered end: reach the visible material
            extendTo={extentShot.closeUp ? target[AXIS_INDEX[view.horizontal]] : undefined}
          />
        )}
        {bore && bores && (
          <ModelBoreMarks
            view={bore}
            centers={bores.centers.map((c) => c.map((v) => v / inchesPerUnit) as Vec3)}
            radius={holeRingRadius(bores.diameter / inchesPerUnit, 1 / zoom)}
            unit={1 / zoom}
          />
        )}
        <AimCamera dir={dir} up={bore ? bore.upVec : view.upVec} zoom={zoom} target={target} distance={maxDim * 3} />
        <OrbitControls makeDefault enableDamping={false} />
      </Canvas>
    </div>
  );
}

function smallestAxis(size: { x: number; y: number; z: number }): Axis {
  return (["x", "y", "z"] as Axis[]).sort((a, b) => size[a] - size[b])[0];
}

interface AimProps {
  dir: Vec3;
  up: Vec3;
  zoom: number;
  target: Vec3;
  distance: number;
}

/** Re-aim whenever the dimension, framing, or figure size changes. Renders nothing. */
function AimCamera({ dir, up, zoom, target, distance }: AimProps) {
  const get = useThree((s) => s.get);
  const [dx, dy, dz] = dir;
  const [ux, uy, uz] = up;
  const [tx, ty, tz] = target;
  useEffect(() => {
    const { camera, controls, invalidate } = get();
    camera.up.set(ux, uy, uz);
    camera.position.set(tx + dx * distance, ty + dy * distance, tz + dz * distance);
    camera.lookAt(tx, ty, tz);
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    }
    const orbit = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
    orbit?.target?.set(tx, ty, tz);
    orbit?.update?.();
    invalidate();
  }, [get, dx, dy, dz, ux, uy, uz, tx, ty, tz, zoom, distance]);
  return null;
}
