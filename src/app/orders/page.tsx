import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/services/profiles.service";
import { listOrderItems } from "@/services/bom.service";
import { AppShell } from "@/components/layout/app-shell";
import { OrderList } from "@/components/orders/order-list";

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, items] = await Promise.all([
    getProfile(supabase, user.id),
    listOrderItems(supabase),
  ]);

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title="Orders"
    >
      <main className="mx-auto max-w-4xl space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          BOM items marked &ldquo;To order&rdquo; across every subsystem, grouped by vendor.
        </p>
        <OrderList initial={items} />
      </main>
    </AppShell>
  );
}
