"use client";

import { Minus, Plus } from "lucide-react";
import { MAX_COPIES } from "@/services/label/transport";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** − n + — thumb-sized, no keyboard needed at the mill. */
export function CopiesStepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const set = (n: number) => onChange(Math.min(MAX_COPIES, Math.max(1, n)));
  return (
    <div className="space-y-1.5">
      <Label id="label-copies">Copies</Label>
      <div role="group" aria-labelledby="label-copies" className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Fewer"
          disabled={disabled || value <= 1}
          onClick={() => set(value - 1)}
        >
          <Minus />
        </Button>
        <output aria-live="polite" className="w-7 text-center text-sm font-medium tabular-nums">
          {value}
        </output>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="More"
          disabled={disabled || value >= MAX_COPIES}
          onClick={() => set(value + 1)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
