"use client";

import { useEffect, useState, type RefObject } from "react";

/** Live content-box size of an element (ResizeObserver); `fallback` until measured. */
export function useElementSize(
  ref: RefObject<HTMLElement | null>,
  fallback: { width: number; height: number },
): { width: number; height: number } {
  const [size, setSize] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
