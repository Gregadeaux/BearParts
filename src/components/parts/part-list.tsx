"use client";

import { useEffect, useState } from "react";
import type { Part, PartStatus } from "@/types/part";
import { createClient } from "@/lib/supabase/client";
import { listParts } from "@/services/parts.service";
import { PartCard } from "./part-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Filter = "active" | "queued" | "mine" | "done";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "queued", label: "Queue" },
  { value: "mine", label: "Mine" },
  { value: "done", label: "Done" },
];

const ACTIVE: PartStatus[] = ["queued", "assigned", "in_progress"];

/** Live part list — refetches on any parts-table change via Realtime. */
export function PartList({ initialParts, userId }: { initialParts: Part[]; userId: string }) {
  const [parts, setParts] = useState(initialParts);
  const [filter, setFilter] = useState<Filter>("active");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("parts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "parts" }, () => {
        listParts(supabase).then(setParts).catch(console.error);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const visible = parts.filter((p) => {
    const status = p.status as PartStatus;
    switch (filter) {
      case "active":
        return ACTIVE.includes(status);
      case "queued":
        return status === "queued";
      case "mine":
        return p.assigned_to === userId && status !== "done" && status !== "rejected";
      case "done":
        return status === "done" || status === "rejected";
    }
  });

  return (
    <div className="space-y-3">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="w-full">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="flex-1">
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((p) => (
            <PartCard key={p.id} part={p} />
          ))}
        </div>
      )}
    </div>
  );
}
