"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateThicknessAction } from "@/app/actions/parts";
import { parseThicknessIn } from "@/services/dimensions/thickness";
import { Input } from "@/components/ui/input";

interface Props {
  partId: string;
  thicknessIn: number | null;
}

/** Inline stock-thickness edit (inches, fractions OK). Saves on blur / Enter. Anyone can edit. */
export function ThicknessField({ partId, thicknessIn }: Props) {
  const router = useRouter();
  const saved = thicknessIn == null ? "" : String(thicknessIn);
  // draft keyed to the saved value so a refresh re-syncs without an effect
  const [draft, setDraft] = useState<{ base: string; value: string }>({ base: saved, value: saved });
  const value = draft.base === saved ? draft.value : saved;
  const [pending, startTransition] = useTransition();

  const commit = () => {
    const text = value.trim();
    const next = text === "" ? null : parseThicknessIn(text);
    if (text !== "" && next === null) {
      toast.error("Thickness must be a number of inches");
      setDraft({ base: saved, value: saved });
      return;
    }
    if (next === (thicknessIn ?? null)) return;
    startTransition(async () => {
      try {
        await updateThicknessAction(partId, next);
        toast.success(next === null ? "Thickness cleared" : "Thickness saved");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save thickness");
        setDraft({ base: saved, value: saved });
      }
    });
  };

  return (
    <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      Thickness
      <Input
        value={value}
        inputMode="decimal"
        enterKeyHint="done"
        placeholder="—"
        disabled={pending}
        aria-label="Stock thickness in inches"
        onChange={(e) => setDraft({ base: saved, value: e.target.value })}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="h-8 w-20 font-mono tabular-nums"
      />
      in
    </label>
  );
}
