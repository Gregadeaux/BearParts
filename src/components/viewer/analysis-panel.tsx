"use client";

import type { DxfAnalysis } from "@/types/analysis";
import { Badge } from "@/components/ui/badge";
import { formatInches } from "@/lib/format";

/** Compact machining summary: size, endmill limit, hole table, warnings. */
export function AnalysisPanel({ analysis }: { analysis: DxfAnalysis }) {
  const { boundingBox: bb, holeGroups, maxEndmillDiameter, sharpCornerCount, warnings } = analysis;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          {formatInches(bb.width)} × {formatInches(bb.height)}
        </Badge>
        <Badge variant="outline">units: {analysis.units}</Badge>
        {maxEndmillDiameter !== null && (
          <Badge variant="outline">max endmill ⌀{formatInches(maxEndmillDiameter)}</Badge>
        )}
        {sharpCornerCount > 0 && (
          <Badge variant="destructive">{sharpCornerCount} sharp corners</Badge>
        )}
      </div>

      {holeGroups.length > 0 && (
        <table className="w-full text-left">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">Hole</th>
              <th className="py-1 font-medium">Qty</th>
              <th className="py-1 font-medium">Looks like</th>
            </tr>
          </thead>
          <tbody>
            {holeGroups.map((g) => (
              <tr key={g.diameter} className="border-t">
                <td className="py-1.5 tabular-nums">⌀{formatInches(g.diameter)}</td>
                <td className="py-1.5 tabular-nums">{g.count}</td>
                <td className="py-1.5">
                  {g.matches.length > 0 ? (
                    <span>
                      {g.matches[0].label}
                      {g.matches[0].drill ? ` (${g.matches[0].drill})` : ""}
                      {g.matches.length > 1 && (
                        <span className="text-muted-foreground">
                          {" "}
                          or {g.matches.slice(1).map((m) => m.label).join(", ")}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">custom</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {warnings.length > 0 && (
        <ul className="space-y-1">
          {warnings.map((w, i) => (
            <li key={i} className="text-xs text-amber-600 dark:text-amber-400">
              ⚠ {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
