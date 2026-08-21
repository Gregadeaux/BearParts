import { createClient } from "@/lib/supabase/server";
import { SigninHandoff } from "@/components/onshape/signin-handoff";

/**
 * Top-level popup target for the Onshape panel's "Sign in" button. Cookie auth
 * works here (proxy redirects to /login?next=/onshape/signin when needed);
 * once signed in, the client component hands the session to the panel iframe.
 */
export default async function OnshapeSigninPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // proxy redirects

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <SigninHandoff />
    </main>
  );
}
