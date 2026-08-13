"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface Options {
  table: string;
  /** postgres_changes filter, e.g. `library_part_id=eq.<id>` */
  filter?: string;
  /** called whenever the table (probably) changed — refetch inside */
  onChange: () => void;
  /** fallback poll while the tab is visible; 0 disables */
  pollMs?: number;
}

/**
 * Live-refetch driver for an RLS'd table.
 *
 * Critical detail: the realtime socket must carry the user's JWT BEFORE the
 * channel subscribes — otherwise RLS is evaluated as `anon` and events are
 * silently dropped. We also re-auth on token refresh, and refetch on tab
 * focus plus a slow poll so a dropped socket can't strand stale data.
 */
export function useLiveTable({ table, filter, onChange, pollMs = 30_000 }: Options) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let disposed = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) await supabase.realtime.setAuth(session.access_token);
      if (disposed) return;

      channel = supabase
        .channel(`live-${table}-${filter ?? "all"}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
          () => onChangeRef.current(),
        )
        .subscribe();
    })();

    // keep the socket's JWT fresh across session refreshes
    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) supabase.realtime.setAuth(session.access_token);
    });

    const refetchIfVisible = () => {
      if (document.visibilityState === "visible") onChangeRef.current();
    };
    document.addEventListener("visibilitychange", refetchIfVisible);
    window.addEventListener("focus", refetchIfVisible);
    const interval = pollMs > 0 ? setInterval(refetchIfVisible, pollMs) : undefined;

    return () => {
      disposed = true;
      authSub.unsubscribe();
      document.removeEventListener("visibilitychange", refetchIfVisible);
      window.removeEventListener("focus", refetchIfVisible);
      if (interval) clearInterval(interval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, filter, pollMs]);
}
