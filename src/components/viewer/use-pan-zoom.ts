"use client";

import { useCallback, useRef, useState } from "react";
import type { BoundingBox } from "@/types/geometry";

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FIT_MARGIN = 0.08;
const MIN_ZOOM_SPAN = 0.02; // inches — don't zoom in past this
const MAX_ZOOM_FACTOR = 40; // don't zoom out past fit × this

/**
 * Pan/zoom state for an SVG viewer: drag to pan, wheel to zoom,
 * two-finger pinch on touch. All in SVG user units.
 */
export function usePanZoom(bbox: BoundingBox) {
  const fit = useCallback((): ViewBox => {
    const m = Math.max(bbox.width, bbox.height, 0.1) * FIT_MARGIN;
    return {
      x: bbox.min.x - m,
      y: -bbox.max.y - m, // CAD y-up → SVG y-down flip
      w: bbox.width + 2 * m,
      h: bbox.height + 2 * m,
    };
  }, [bbox]);

  const [view, setView] = useState<ViewBox>(fit);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; view: ViewBox; mid: { x: number; y: number } } | null>(null);
  const moved = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  /** client px → SVG user units */
  const toSvg = useCallback(
    (clientX: number, clientY: number, v: ViewBox) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const scale = Math.max(v.w / rect.width, v.h / rect.height);
      // preserveAspectRatio xMidYMid: content centered in the element
      const ox = v.x - (rect.width * scale - v.w) / 2;
      const oy = v.y - (rect.height * scale - v.h) / 2;
      return { x: ox + (clientX - rect.left) * scale, y: oy + (clientY - rect.top) * scale };
    },
    [],
  );

  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      setView((v) => {
        const p = toSvg(cx, cy, v);
        const fitted = fit();
        const maxSpan = Math.max(fitted.w, fitted.h) * MAX_ZOOM_FACTOR;
        const next = Math.min(Math.max(v.w * factor, MIN_ZOOM_SPAN), maxSpan);
        const f = next / v.w;
        return {
          x: p.x - (p.x - v.x) * f,
          y: p.y - (p.y - v.y) * f,
          w: v.w * f,
          h: v.h * f,
        };
      });
    },
    [fit, toSvg],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.15 : 1 / 1.15);
    },
    [zoomAt],
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    pinchStart.current = null;
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) return;
      const pts = pointers.current;

      if (pts.size === 2) {
        // pinch zoom
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [a, b] = [...pts.values()];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (!pinchStart.current) {
          setView((v) => {
            pinchStart.current = { dist, view: v, mid };
            return v;
          });
          return;
        }
        const start = pinchStart.current;
        const f = start.dist / Math.max(dist, 1);
        setView(() => {
          const v0 = start.view;
          const p = toSvg(start.mid.x, start.mid.y, v0);
          const w = v0.w * f;
          const h = v0.h * f;
          const rect = svgRef.current?.getBoundingClientRect();
          const scale = rect ? Math.max(w / rect.width, h / rect.height) : 0;
          const dx = rect ? (mid.x - start.mid.x) * scale : 0;
          const dy = rect ? (mid.y - start.mid.y) * scale : 0;
          return {
            x: p.x - (p.x - v0.x) * f - dx,
            y: p.y - (p.y - v0.y) * f - dy,
            w,
            h,
          };
        });
        moved.current = true;
        return;
      }

      // single-pointer pan
      const dxPx = e.clientX - prev.x;
      const dyPx = e.clientY - prev.y;
      if (Math.abs(dxPx) + Math.abs(dyPx) > 3) moved.current = true;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      setView((v) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return v;
        const scale = Math.max(v.w / rect.width, v.h / rect.height);
        return { ...v, x: v.x - dxPx * scale, y: v.y - dyPx * scale };
      });
    },
    [toSvg],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  }, []);

  const reset = useCallback(() => setView(fit()), [fit]);

  return {
    svgRef,
    view,
    viewBox: `${view.x} ${view.y} ${view.w} ${view.h}`,
    /** px→units scale for sizing markers/strokes */
    unitsPerPx: () => {
      const rect = svgRef.current?.getBoundingClientRect();
      return rect ? Math.max(view.w / rect.width, view.h / rect.height) : 0.01;
    },
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    /** true if the last gesture was a drag (suppress click-through) */
    wasDrag: () => moved.current,
    zoomIn: () => centerZoom(svgRef.current, zoomAt, 1 / 1.4),
    zoomOut: () => centerZoom(svgRef.current, zoomAt, 1.4),
    reset,
  };
}

function centerZoom(
  svg: SVGSVGElement | null,
  zoomAt: (x: number, y: number, f: number) => void,
  factor: number,
) {
  const rect = svg?.getBoundingClientRect();
  if (rect) zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
}
