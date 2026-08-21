"use client";

import type { AnalyzedHole } from "@/types/analysis";

const KIND_COLORS: Record<string, string> = {
  tap: "var(--color-red-500, #ef4444)",
  "close-fit": "var(--color-blue-500, #3b82f6)",
  "free-fit": "var(--color-sky-400, #38bdf8)",
  bearing: "var(--color-amber-500, #f59e0b)",
  shaft: "var(--color-violet-500, #8b5cf6)",
};

export function holeColor(hole: AnalyzedHole): string {
  const kind = hole.matches[0]?.kind;
  return (kind && KIND_COLORS[kind]) || "var(--color-zinc-400, #a1a1aa)";
}

interface Props {
  holes: AnalyzedHole[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  unitsPerPx: number;
}

/** Colored rings over classified holes; rendered in flipped-Y viewer space. */
export function HoleMarkers({ holes, selectedIndex, onSelect, unitsPerPx }: Props) {
  // big holes first so small neighbors render on top and win overlapping taps
  const ordered = holes
    .map((hole, index) => ({ hole, index }))
    .sort((a, b) => b.hole.diameter - a.hole.diameter);

  return (
    <g>
      {ordered.map(({ hole, index }) => {
        const r = hole.diameter / 2;
        const selected = index === selectedIndex;
        return (
          <g key={index} transform={`translate(${hole.center.x} ${-hole.center.y})`}>
            <circle
              r={r}
              fill={selected ? holeColor(hole) : "transparent"}
              fillOpacity={selected ? 0.25 : 0}
              stroke={holeColor(hole)}
              strokeWidth={(selected ? 2.5 : 1.5) * unitsPerPx}
            />
            {/* tap target: a few px past the rim (a scale-free multiplier let
                big bores swallow clicks meant for neighboring holes) */}
            <circle
              r={Math.max(r + 4 * unitsPerPx, 12 * unitsPerPx)}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(index);
              }}
            />
          </g>
        );
      })}
    </g>
  );
}
