"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { GizmoHelper, GizmoViewcube, OrbitControls } from "@react-three/drei";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { GcodeToolpath } from "@/services/gcode/gcode-parser";

interface Props {
  toolpath: GcodeToolpath;
  className?: string;
}

const SPEEDS = [1, 2, 4, 10, 50];

/** Machine-ish assumptions for moves the program doesn't time itself. */
const rapidRate = (inches: boolean) => (inches ? 400 : 10_000); // units/min
const fallbackFeed = (inches: boolean) => (inches ? 30 : 800);

interface Timeline {
  /** ordered vertex positions, 2 per segment */
  pristine: Float32Array;
  colors: Float32Array;
  /** cumulative seconds at the END of each segment; [0] = 0 */
  cumTimes: Float64Array;
  total: number;
}

function buildTimeline(toolpath: GcodeToolpath): Timeline {
  const n = toolpath.segments.length;
  const pristine = new Float32Array(n * 6);
  const colors = new Float32Array(n * 6);
  const cumTimes = new Float64Array(n + 1);
  const cut = new THREE.Color("#d97706");
  const rapid = new THREE.Color("#a1a1aa");
  const rr = rapidRate(toolpath.inches);
  const ff = fallbackFeed(toolpath.inches);

  for (let i = 0; i < n; i++) {
    const seg = toolpath.segments[i];
    pristine.set(seg.from, i * 6);
    pristine.set(seg.to, i * 6 + 3);
    const c = seg.rapid ? rapid : cut;
    colors.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
    const len = Math.hypot(
      seg.to[0] - seg.from[0],
      seg.to[1] - seg.from[1],
      seg.to[2] - seg.from[2],
    );
    const rate = seg.rapid ? rr : (seg.feed ?? ff);
    cumTimes[i + 1] = cumTimes[i] + (len / Math.max(rate, 1e-6)) * 60;
  }
  return { pristine, colors, cumTimes, total: cumTimes[n] };
}

const fmtClock = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

/** 3D toolpath preview with feed-accurate playback. */
export function GcodeViewer({ toolpath, className }: Props) {
  const { size } = toolpath.boundingBox;
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const camDist = maxDim * 1.8;

  const timeline = useMemo(() => buildTimeline(toolpath), [toolpath]);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [clock, setClock] = useState(0); // throttled UI copy of playback time
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(speed);
  useEffect(() => {
    playingRef.current = playing;
    speedRef.current = speed;
  }, [playing, speed]);
  const started = clock > 0 || playing;

  const seek = useCallback((t: number) => {
    timeRef.current = Math.max(0, t);
    setClock(timeRef.current);
  }, []);

  return (
    <div className={`relative overflow-hidden rounded-lg border bg-card ${className ?? ""}`}>
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
        <ToolpathScene
          toolpath={toolpath}
          timeline={timeline}
          markerSize={maxDim / 90}
          animating={started}
          timeRef={timeRef}
          playingRef={playingRef}
          speedRef={speedRef}
          onTick={setClock}
          onDone={() => setPlaying(false)}
        />
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

      {/* playback bar */}
      <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-md border bg-background/85 px-2 py-1.5 backdrop-blur">
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          className="rounded p-1 hover:bg-muted"
          onClick={() => {
            if (!playing && timeRef.current >= timeline.total) seek(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button
          type="button"
          aria-label="Restart"
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          onClick={() => seek(0)}
        >
          <RotateCcw className="size-3.5" />
        </button>
        <input
          type="range"
          min={0}
          max={timeline.total}
          step={timeline.total / 1000}
          value={Math.min(clock, timeline.total)}
          onChange={(e) => seek(Number(e.target.value))}
          className="min-w-0 flex-1 accent-amber-600"
          aria-label="Playback position"
        />
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {fmtClock(Math.min(clock, timeline.total))} / {fmtClock(timeline.total)}
        </span>
        <div className="flex shrink-0 gap-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={`rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
                speed === s ? "bg-amber-600 text-white" : "text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setSpeed(s)}
              aria-pressed={speed === s}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolpathScene({
  toolpath,
  timeline,
  markerSize,
  animating,
  timeRef,
  playingRef,
  speedRef,
  onTick,
  onDone,
}: {
  toolpath: GcodeToolpath;
  timeline: Timeline;
  markerSize: number;
  animating: boolean;
  timeRef: React.RefObject<number>;
  playingRef: React.RefObject<boolean>;
  speedRef: React.RefObject<number>;
  onTick: (t: number) => void;
  onDone: () => void;
}) {
  const progressGeo = useRef<THREE.BufferGeometry>(null);
  const marker = useRef<THREE.Group>(null);
  const appliedSeg = useRef(-1);
  const lastUiPush = useRef(0);

  const { fullGeo, center, progressPositions } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(timeline.pristine, 3));
    g.setAttribute("color", new THREE.BufferAttribute(timeline.colors, 3));
    const { min, max } = toolpath.boundingBox;
    return {
      fullGeo: g,
      center: new THREE.Vector3(-(min.x + max.x) / 2, -(min.y + max.y) / 2, -(min.z + max.z) / 2),
      progressPositions: timeline.pristine.slice(),
    };
  }, [toolpath, timeline]);

  const applyTime = useCallback(
    (t: number) => {
      const geo = progressGeo.current;
      if (!geo) return;
      const { cumTimes, pristine } = timeline;
      // binary search: last segment whose start time <= t
      let lo = 0;
      let hi = cumTimes.length - 2;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cumTimes[mid] <= t) lo = mid;
        else hi = mid - 1;
      }
      const segIndex = lo;
      const attr = geo.getAttribute("position") as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;

      // moving backwards (or first apply): restore pristine endpoints
      if (segIndex < appliedSeg.current || appliedSeg.current === -1) {
        arr.set(pristine);
      } else {
        // restore true endpoints of segments we passed since last frame
        for (let i = appliedSeg.current; i < segIndex; i++) {
          arr[i * 6 + 3] = pristine[i * 6 + 3];
          arr[i * 6 + 4] = pristine[i * 6 + 4];
          arr[i * 6 + 5] = pristine[i * 6 + 5];
        }
      }
      appliedSeg.current = segIndex;

      const segStart = cumTimes[segIndex];
      const segDur = cumTimes[segIndex + 1] - segStart;
      const frac = segDur > 1e-9 ? Math.min(1, (t - segStart) / segDur) : 1;
      const base = segIndex * 6;
      const px = pristine[base] + (pristine[base + 3] - pristine[base]) * frac;
      const py = pristine[base + 1] + (pristine[base + 4] - pristine[base + 1]) * frac;
      const pz = pristine[base + 2] + (pristine[base + 5] - pristine[base + 2]) * frac;
      arr[base + 3] = px;
      arr[base + 4] = py;
      arr[base + 5] = pz;

      geo.setDrawRange(0, (segIndex + 1) * 2);
      attr.needsUpdate = true;
      marker.current?.position.set(px, py, pz);
    },
    [timeline],
  );

  useFrame((_, delta) => {
    if (playingRef.current) {
      timeRef.current = Math.min(timeRef.current + delta * speedRef.current, timeline.total);
      if (timeRef.current >= timeline.total) onDone();
      // throttle React updates to ~5/s; the scrubber doesn't need 60fps
      if (performance.now() - lastUiPush.current > 200 || timeRef.current >= timeline.total) {
        lastUiPush.current = performance.now();
        onTick(timeRef.current);
      }
    }
    if (animating) applyTime(timeRef.current);
  });

  // reset draw state when a new file loads
  useEffect(() => {
    appliedSeg.current = -1;
  }, [timeline]);

  return (
    <group position={center}>
      {/* full path — ghosted while playback is active */}
      <lineSegments geometry={fullGeo}>
        <lineBasicMaterial vertexColors transparent opacity={animating ? 0.18 : 0.9} />
      </lineSegments>

      {animating && (
        <>
          <lineSegments>
            <bufferGeometry
              ref={progressGeo}
              onUpdate={(g) => {
                if (!g.getAttribute("position")) {
                  g.setAttribute("position", new THREE.BufferAttribute(progressPositions, 3));
                  g.setAttribute("color", new THREE.BufferAttribute(timeline.colors, 3));
                  g.setDrawRange(0, 0);
                }
              }}
            />
            <lineBasicMaterial vertexColors />
          </lineSegments>
          {/* endmill: amber fluted section + gray shank, tip at the toolpoint */}
          <group ref={marker}>
            <mesh position={[0, 0, markerSize * 2]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[markerSize * 0.7, markerSize * 0.7, markerSize * 4, 20]} />
              <meshBasicMaterial color="#f59e0b" />
            </mesh>
            <mesh position={[0, 0, markerSize * 6.5]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[markerSize * 0.6, markerSize * 0.6, markerSize * 5, 20]} />
              <meshBasicMaterial color="#9ca3af" />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
}
