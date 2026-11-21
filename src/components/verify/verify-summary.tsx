"use client";

import { CircleAlert, CircleCheck, CircleX, Loader2 } from "lucide-react";
import type { MeasuredDimension, VerificationResult } from "@/types/verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MeasurementList } from "./measurement-list";

const HEADLINE: Record<VerificationResult, { text: string; icon: typeof CircleCheck; tone: string }> = {
  pass: {
    text: "PASS",
    icon: CircleCheck,
    tone: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  },
  fail: {
    text: "FAIL",
    icon: CircleX,
    tone: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  incomplete: {
    text: "INCOMPLETE",
    icon: CircleAlert,
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
};

interface Props {
  rows: MeasuredDimension[];
  result: VerificationResult;
  /** STEP hole sizes the check left out (cap) */
  omittedHoles?: number;
  note: string;
  onNoteChange: (note: string) => void;
  onEdit: (index: number) => void;
  onSave: () => void;
  saving: boolean;
}

/** Final step: overall result, every measurement (tap to fix), optional note, save. */
export function VerifySummary({
  rows,
  result,
  omittedHoles = 0,
  note,
  onNoteChange,
  onEdit,
  onSave,
  saving,
}: Props) {
  const { text, icon: Icon, tone } = HEADLINE[result];
  const misses = rows.filter((r) => r.pass === false).length;
  const skips = rows.filter((r) => r.measured === null).length;

  return (
    <div className="space-y-4">
      <div className={cn("flex items-center gap-3 rounded-lg px-4 py-3", tone)}>
        <Icon className="size-8 shrink-0" />
        <div>
          <p className="text-2xl leading-none font-bold tracking-wide">{text}</p>
          <p className="mt-1 text-sm">
            {[misses > 0 && `${misses} out`, skips > 0 && `${skips} skipped`]
              .filter(Boolean)
              .join(" · ") || `All ${rows.length} in tolerance`}
          </p>
        </div>
      </div>

      <MeasurementList rows={rows} onSelect={onEdit} />
      <p className="-mt-2 text-xs text-muted-foreground">
        Tap a row to fix a typo — changes are marked re-measured.
        {omittedHoles > 0 &&
          ` ${omittedHoles} more hole size${omittedHoles === 1 ? "" : "s"} not in this check.`}
      </p>

      <Input
        value={note}
        maxLength={500}
        placeholder="Note (optional)"
        onChange={(e) => onNoteChange(e.target.value)}
        className="h-11"
      />

      <Button size="lg" className="h-12 w-full" disabled={saving} onClick={onSave}>
        {saving ? <Loader2 className="animate-spin" /> : null}
        Save check
      </Button>
    </div>
  );
}
