"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getPanelClient } from "@/lib/supabase/panel-client";
import { PANEL_SESSION_MESSAGE } from "./signin-handoff";

/**
 * BearParts session inside the Onshape iframe. Restores from localStorage;
 * `signIn` opens a top-level popup (/onshape/signin) that posts tokens back.
 */
export function usePanelSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getPanelClient();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      const data = e.data as { type?: string; access_token?: string; refresh_token?: string };
      if (data?.type !== PANEL_SESSION_MESSAGE || !data.access_token || !data.refresh_token) return;
      supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
    };
    window.addEventListener("message", onMessage);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("message", onMessage);
    };
  }, []);

  const signIn = useCallback(() => {
    window.open(`${location.origin}/onshape/signin`, "bearparts-signin", "width=480,height=640");
  }, []);

  const signOut = useCallback(() => {
    getPanelClient().auth.signOut();
  }, []);

  return { session, loading, signIn, signOut };
}
