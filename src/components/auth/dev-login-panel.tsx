"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/** Seeded by scripts/create-test-users.mjs. */
const DEV_ACCOUNTS = [
  { label: "🎨 Dana Designer", email: "designer@test.bearparts.dev", password: "bearparts-test-1" },
  { label: "🔧 Mack Machinist", email: "machinist@test.bearparts.dev", password: "bearparts-test-2" },
];

/**
 * Stand-in for Google OAuth while it isn't configured. The /api/dev-login
 * route hard-404s in production, so this panel is dev-only end to end.
 */
export function DevLoginPanel({ next = "/" }: { next?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const signIn = (email: string, password: string) =>
    startTransition(async () => {
      const res = await fetch("/api/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "sign-in failed" }));
        toast.error(error ?? "Sign-in failed");
        return;
      }
      router.push(next);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">dev only</span>
        <Separator className="flex-1" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {DEV_ACCOUNTS.map((a) => (
          <Button
            key={a.email}
            variant="outline"
            disabled={pending}
            onClick={() => signIn(a.email, a.password)}
          >
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
