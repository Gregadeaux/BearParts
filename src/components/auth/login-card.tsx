"use client";

import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DevLoginPanel } from "./dev-login-panel";

export function LoginCard() {
  const params = useSearchParams();
  const failed = params.get("error") === "auth";
  const rawNext = params.get("next");
  const next = rawNext?.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const signIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  };

  return (
    <Card className="w-full max-w-sm text-center">
      <CardHeader>
        <CardTitle className="text-2xl">BearParts</CardTitle>
        <CardDescription>Part queue for the shop</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {failed && (
          <p className="text-sm text-destructive">Sign-in failed — try again.</p>
        )}
        <Button className="w-full" size="lg" onClick={signIn}>
          Sign in with Google
        </Button>
        {process.env.NODE_ENV !== "production" && <DevLoginPanel next={next} />}
      </CardContent>
    </Card>
  );
}
