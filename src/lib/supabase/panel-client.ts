"use client";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let client: ReturnType<typeof createPanelClient> | null = null;

/**
 * Supabase client for the Onshape panel iframe. Sessions live in
 * localStorage (partitioned per embedding site but persistent), not cookies —
 * cookies are third-party inside cad.onshape.com and get blocked.
 */
export function createPanelClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storageKey: "bearparts-onshape-panel",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  );
}

export function getPanelClient() {
  if (!client) client = createPanelClient();
  return client;
}
