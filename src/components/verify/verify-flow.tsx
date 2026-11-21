"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { KeyDimension } from "@/services/dimensions/key-dimensions";
import {
  checkReading,
  gradeDimension,
  markRevisions,
  overallResult,
  withoutFeatures,
} from "@/services/dimensions/verification";
import { createVerificationAction } from "@/app/actions/verifications";
import { DimensionStep } from "./dimension-step";
import { DimensionFigure, type FigureSource } from "./dimension-figure";
import { VerifySummary } from "./verify-summary";

interface Props {
  partId: string;
  dims: KeyDimension[];
  /** geometry for the per-step picture; null = words only */
  figure: FigureSource | null;
  /** STEP hole sizes left out of this check (cap) — mentioned at the reveal */
  omittedHoles?: number;
  onSaved: () => void;
}

const SAVED_TOAST = {
  pass: "Verified ✓",
  fail: "Saved — failed check, submitter notified",
  incomplete: "Saved as incomplete",
} as const;

/**
 * Walk the key dimensions BLIND (no nominal, tolerance, or pass/fail on the
 * entry steps), then reveal everything on the summary. Readings can still be
 * fixed after the reveal, but those rows are flagged `revised` in the record.
 */
export function VerifyFlow({ partId, dims, figure, omittedHoles = 0, onSaved }: Props) {
  const [step, setStep] = useState(0); // dims.length = summary
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [saving, startSaving] = useTransition();
  // readings as they stood when the summary was first shown; null = not revealed yet
  const [firstSeen, setFirstSeen] = useState<Record<string, number | null> | null>(null);

  const readings = dims.map((d) => checkReading(raw[d.id] ?? ""));
  const rows = markRevisions(
    dims.map((d, i) => gradeDimension(d, readings[i].value)),
    firstSeen,
  );
  const result = overallResult(rows);

  /** @param skippedId the dimension just skipped (its reading is being cleared this tick) */
  const advance = (skippedId?: string) => {
    // once revealed, Next/Skip go straight back to the summary
    const next = firstSeen ? dims.length : step + 1;
    if (next >= dims.length && !firstSeen) {
      setFirstSeen(
        Object.fromEntries(dims.map((d, i) => [d.id, d.id === skippedId ? null : readings[i].value])),
      );
    }
    setStep(next);
  };

  const save = () =>
    startSaving(async () => {
      try {
        const saved = await createVerificationAction(partId, withoutFeatures(rows), note);
        toast.success(SAVED_TOAST[saved.result]);
        onSaved();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save check");
      }
    });

  if (step >= dims.length) {
    return (
      <VerifySummary
        rows={rows}
        result={result}
        omittedHoles={omittedHoles}
        note={note}
        onNoteChange={setNote}
        onEdit={setStep}
        onSave={save}
        saving={saving}
      />
    );
  }

  const dim = dims[step];
  return (
    <DimensionStep
      dim={dim}
      index={step}
      total={dims.length}
      value={raw[dim.id] ?? ""}
      problem={readings[step].problem}
      figure={figure ? <DimensionFigure source={figure} dim={dim} /> : null}
      onChange={(value) => setRaw((r) => ({ ...r, [dim.id]: value }))}
      onNext={() => advance()}
      onSkip={() => {
        setRaw((r) => ({ ...r, [dim.id]: "" }));
        advance(dim.id);
      }}
      onBack={step > 0 ? () => setStep(step - 1) : null}
    />
  );
}
