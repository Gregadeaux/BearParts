"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import type { KeyDimension } from "@/services/dimensions/key-dimensions";
import { dimensionHint, dimensionTitle } from "@/services/dimensions/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  dim: KeyDimension;
  index: number;
  total: number;
  value: string;
  /** neutral sanity message for impossible input (never about the nominal) */
  problem: string | null;
  /** picture of the part with this dimension called out (no numbers) */
  figure?: React.ReactNode;
  onChange: (value: string) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: (() => void) | null;
}

/**
 * One BLIND measurement: what to measure (words + picture) and the input —
 * no expected value, tolerance, or pass/fail until the summary. Every row is
 * fixed-height so steps never jump; Next sits beside the input so it's
 * reachable with the keypad up.
 */
export function DimensionStep({ dim, index, total, value, problem, figure, onChange, onNext, onSkip, onBack }: Props) {
  const last = index === total - 1;
  const canNext = value.trim() !== "" && problem === null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {index + 1} / {total}
        </span>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${(index / total) * 100}%` }} />
        </div>
      </div>

      <div>
        <p className="truncate text-xl leading-tight font-semibold">{dimensionTitle(dim)}</p>
        <p className="truncate text-xs text-muted-foreground">{dimensionHint(dim)}</p>
      </div>

      {figure}

      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canNext) onNext();
        }}
      >
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Input
              key={dim.id}
              autoFocus
              inputMode="decimal"
              enterKeyHint={last ? "done" : "next"}
              autoComplete="off"
              aria-label={`Measured ${dimensionTitle(dim)} in inches`}
              aria-invalid={problem !== null || undefined}
              placeholder="0.000"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-12 pr-9 font-mono text-2xl tabular-nums md:text-2xl"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
              in
            </span>
          </div>
          <Button type="submit" size="lg" className="h-12 px-4" disabled={!canNext}>
            {last ? "Review" : "Next"} <ArrowRight />
          </Button>
        </div>
        <p aria-live="polite" className={`h-5 text-sm ${problem ? "text-destructive" : "text-muted-foreground"}`}>
          {problem ?? "Type what the calipers say"}
        </p>
        <div className="flex gap-2">
          {onBack && (
            <Button type="button" variant="ghost" className="h-10" onClick={onBack} aria-label="Back">
              <ArrowLeft />
            </Button>
          )}
          <Button type="button" variant="outline" className="h-10 flex-1" onClick={onSkip}>
            Skip
          </Button>
        </div>
      </form>
    </div>
  );
}
