import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Dev-only email/password login so automated tests can get a session
 * without the Google OAuth dance. Hard-disabled in production builds.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  const { email, password } = (await request.json()) as { email?: string; password?: string };
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: error.message }, { status: 401 });
  return NextResponse.json({ ok: true });
}
