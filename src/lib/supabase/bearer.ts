import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client authenticated by a Bearer token instead of
 * cookies — for API routes called from the Onshape panel iframe, where
 * third-party cookie rules block our normal session cookies.
 */
export function createBearerClient(accessToken: string) {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export interface BearerAuth {
  supabase: ReturnType<typeof createBearerClient>;
  user: User;
}

/** Resolve the request's Authorization header to a Supabase user, or null. */
export async function bearerAuth(request: Request): Promise<BearerAuth | null> {
  const header = request.headers.get("authorization");
  const token = header?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;
  const supabase = createBearerClient(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return null;
  return { supabase, user };
}
