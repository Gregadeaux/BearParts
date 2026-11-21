import { CircleCheck, CircleMinus, CircleX } from "lucide-react";
import type { MeasuredDimension } from "@/types/verification";
import { formatInches } from "@/services/dimensions/key-dimensions";
import { dimensionTitle, formatDeviation, formatTolerance } from "@/services/dimensions/format";
import { cn } from "@/lib/utils";

interface Props {
  rows: MeasuredDimension[];
  /** tap a row to jump back and re-measure (summary step) */
  onSelect?: (index: number) => void;
}

const firstLabel = (v: number | null | undefined) => (v == null ? "skipped" : formatInches(v));

/**
 * Compact per-dimension results — the REVEAL: expected vs measured,
 * deviation, pass/fail, the hole-match note, and a "re-measured" flag on
 * readings changed after the reveal.
 */
export function MeasurementList({ rows, onSelect }: Props) {
  return (
    <ul className="divide-y overflow-hidden rounded-lg border">
      {rows.map((row, i) => {
        const Icon = row.pass === null ? CircleMinus : row.pass ? CircleCheck : CircleX;
        const tone =
          row.pass === null
            ? "text-muted-foreground"
            : row.pass
              ? "text-green-700 dark:text-green-400"
              : "text-red-600 dark:text-red-400";
        const body = (
          <>
            <Icon className={cn("size-4 shrink-0", tone)} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">{dimensionTitle(row)}</span>
                {row.revised && (
                  <span
                    title={`First entered: ${firstLabel(row.firstMeasured)}`}
                    className="shrink-0 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  >
                    re-measured
                  </span>
                )}
              </span>
              <span className="block truncate font-mono text-xs text-muted-foreground tabular-nums">
                {formatInches(row.nominal)} {formatTolerance(row.tolerance)}
                {row.note && <span className="font-sans"> · {row.note}</span>}
              </span>
            </span>
            <span className="shrink-0 text-right font-mono tabular-nums">
              <span className="block text-sm">{row.measured === null ? "skipped" : formatInches(row.measured)}</span>
              {row.deviation !== null && (
                <span className={cn("block text-xs", tone)}>{formatDeviation(row.deviation)}</span>
              )}
            </span>
          </>
        );
        return (
          <li key={row.id}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(i)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50"
              >
                {body}
              </button>
            ) : (
              <div className="flex items-center gap-2.5 px-3 py-2">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
