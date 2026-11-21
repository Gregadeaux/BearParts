"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import type { PartVerification } from "@/types/verification";
import { deleteVerificationAction } from "@/app/actions/verifications";
import { useCan } from "@/components/auth/role-context";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MeasurementList } from "./measurement-list";
import { VerificationBadge } from "./verification-badge";

/** One recorded check: result, who, when — expands to the measurements. Leads can delete. */
export function VerificationRow({ verification: v }: { verification: PartVerification }) {
  const router = useRouter();
  const can = useCan();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      try {
        await deleteVerificationAction(v.id);
        toast.success("Check deleted");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete check");
      }
    });

  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50">
        <VerificationBadge result={v.result} />
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {v.verifier?.display_name ?? "Unknown"} · {formatDateTime(v.created_at)}
          {v.dimensions.some((d) => d.revised) && (
            <span className="text-amber-700 dark:text-amber-400"> · re-measured</span>
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 px-3 pb-3">
        <MeasurementList rows={v.dimensions} />
        {v.note && <p className="text-sm">{v.note}</p>}
        {can.destroy && (
          <Button
            variant={confirming ? "destructive" : "ghost"}
            size="sm"
            disabled={pending}
            onClick={() => (confirming ? remove() : setConfirming(true))}
            onBlur={() => setConfirming(false)}
          >
            {confirming ? "Really delete?" : "Delete check"}
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
