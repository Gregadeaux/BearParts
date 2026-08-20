"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { unreadCount } from "@/services/inbox.service";
import { useLiveTable } from "@/lib/use-live-table";

/** Live unread notification count for the signed-in user (RLS scopes the rows). */
export function useUnreadCount() {
  const [count, setCount] = useState(0);

  const refetch = useCallback(() => {
    unreadCount(createClient()).then(setCount).catch(() => {});
  }, []);

  useEffect(refetch, [refetch]);
  useLiveTable({ table: "notifications", onChange: refetch });

  return count;
}
