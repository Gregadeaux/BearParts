import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/** Browser Supabase client (anon key, user session from cookies). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export type AppSupabaseClient = ReturnType<typeof createClient>;
