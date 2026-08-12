"use client";

import { useEffect } from "react";

/** Registers /sw.js once on load. Renders nothing. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline shell is a nice-to-have; ignore failures */
      });
    }
  }, []);
  return null;
}
