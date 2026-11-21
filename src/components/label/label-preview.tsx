"use client";

import { useEffect, useRef } from "react";
import type { LabelPrint } from "@/services/label/draw";
import { rasterToRgba } from "@/services/label/raster";

/**
 * The exact bits that will be sent — read back out of the head-width raster at
 * the label's offset, one canvas pixel per printer dot, scaled up without smoothing.
 */
export function LabelPreview({ print, label }: { print: LabelPrint; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { widthDots, heightDots } = print.layout;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const pixels = rasterToRgba(print.head, print.offsetDots, widthDots);
    ctx.putImageData(new ImageData(pixels, widthDots, heightDots), 0, 0);
  }, [print, widthDots, heightDots]);

  return (
    <canvas
      ref={ref}
      width={widthDots}
      height={heightDots}
      role="img"
      aria-label={label}
      data-label-preview
      className="mx-auto block w-full max-w-80 rounded-md bg-white shadow-sm ring-1 ring-foreground/15 [image-rendering:pixelated]"
      style={{ aspectRatio: `${widthDots} / ${heightDots}` }}
    />
  );
}
