"use client";

import type { AnalyzedHole } from "@/types/analysis";
import { holeColor } from "./hole-markers";
import { formatInches } from "@/lib/format";

/** Bottom-anchored detail chip for the selected hole — thumb-reachable on phones. */
export function HoleInfoChip({ hole, onClose }: { hole: AnalyzedHole; onClose: () => void }) {
  const best = hole.matches[0];
  const alternates = hole.matches.slice(1);

  return (
    <button
      type="button"
      onClick={onClose}
      className="absolute bottom-2 left-1/2 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-2 rounded-full border bg-background/95 px-4 py-2 text-sm shadow-lg backdrop-blur"
    >
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: holeColor(hole) }} />
      <span className="font-medium tabular-nums">⌀{formatInches(hole.diameter)}</span>
      {best ? (
        <span className="truncate">
          {best.label}
          {best.drill ? ` (${best.drill})` : ""}
          {alternates.length > 0 && (
            <span className="text-muted-foreground"> · or {alternates.map((m) => m.label).join(", ")}</span>
          )}
        </span>
      ) : (
        <span className="text-muted-foreground">no standard match</span>
      )}
    </button>
  );
}
