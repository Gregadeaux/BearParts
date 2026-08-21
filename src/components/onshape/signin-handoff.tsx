"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const PANEL_SESSION_MESSAGE = "bearparts:panel-session";

/**
 * Reads the cookie-based session and posts it to the Onshape panel iframe
 * that opened this popup, then closes. Same-origin only.
 */
export function SigninHandoff() {
  const [status, setStatus] = useState<"working" | "done" | "no-opener" | "error">("working");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      if (cancelled) return;
      if (!session) {
        setStatus("error");
        return;
      }
      if (!window.opener) {
        setStatus("no-opener");
        return;
      }
      (window.opener as Window).postMessage(
        {
          type: PANEL_SESSION_MESSAGE,
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        },
        location.origin,
      );
      setStatus("done");
      setTimeout(() => window.close(), 400);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <p className="text-sm text-muted-foreground">
      {status === "working" && "Connecting to the Onshape panel…"}
      {status === "done" && "Signed in — you can close this window."}
      {status === "no-opener" && "Open this page from the Onshape panel's sign-in button."}
      {status === "error" && "No session found — sign in and try again."}
    </p>
  );
}
