"use client";

import type { CurveHit } from "@/services/dxf/snap.service";
import { formatInches } from "@/lib/format";

/** Bottom-anchored chip for a tapped curved edge — mirrors the hole chip. */
export function CurveInfoChip({ curve, onClose }: { curve: CurveHit; onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="absolute bottom-2 left-1/2 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-2 rounded-full border bg-background/95 px-4 py-2 text-sm shadow-lg backdrop-blur"
    >
      <span className="size-2.5 shrink-0 rounded-full bg-emerald-500" />
      <span className="font-medium tabular-nums">R{formatInches(curve.radius)}</span>
      <span className="text-muted-foreground">
        radius · ⌀{formatInches(curve.radius * 2)}
      </span>
    </button>
  );
}
