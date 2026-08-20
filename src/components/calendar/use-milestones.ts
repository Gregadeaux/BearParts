"use client";

import { useCallback, useState } from "react";
import type { MilestoneRow } from "@/services/milestones.service";
import { listMilestones } from "@/services/milestones.service";
import { createClient } from "@/lib/supabase/client";
import { useLiveTable } from "@/lib/use-live-table";

/** Live milestone list — server data first, then realtime refetches. */
export function useMilestones(initial: MilestoneRow[]) {
  const [milestones, setMilestones] = useState(initial);

  const refetch = useCallback(() => {
    listMilestones(createClient()).then(setMilestones).catch(console.error);
  }, []);

  useLiveTable({ table: "milestones", onChange: refetch });

  return { milestones, refetch };
}

export function milestonesOnDay(milestones: MilestoneRow[], day: string): MilestoneRow[] {
  return milestones.filter((m) => m.date === day);
}
