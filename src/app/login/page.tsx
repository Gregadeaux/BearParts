import { Suspense } from "react";
import { LoginCard } from "@/components/auth/login-card";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Suspense>
        <LoginCard />
      </Suspense>
    </main>
  );
}
