"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Archive } from "lucide-react";
import type { Part } from "@/types/part";
import { createClient } from "@/lib/supabase/client";
import { listArchivedParts } from "@/services/parts.service";
import { setArchivedAction } from "@/app/actions/parts";
import { StatusBadge } from "./status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDate } from "@/lib/format";

/** Slide-over listing archived cards with one-tap restore. */
export function ArchivedSheet() {
  const [open, setOpen] = useState(false);
  const [parts, setParts] = useState<Part[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    listArchivedParts(createClient()).then(setParts).catch(() => {
      toast.error("Could not load archive");
      setParts([]);
    });
  }, [open]);

  const restore = (part: Part) =>
    startTransition(async () => {
      try {
        await setArchivedAction(part.id, false);
        setParts((ps) => ps?.filter((p) => p.id !== part.id) ?? null);
        toast.success(`"${part.name}" restored`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not restore");
      }
    });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="sm" nativeButton />}>
        <Archive /> Archived
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Archived parts</SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 px-4 pb-4">
            {parts === null ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : parts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing archived.</p>
            ) : (
              parts.map((part) => (
                <div key={part.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/parts/${part.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {part.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      archived {part.archived_at ? formatDate(part.archived_at) : ""}
                    </p>
                  </div>
                  <StatusBadge status={part.status as never} />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => restore(part)}
                  >
                    Restore
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
