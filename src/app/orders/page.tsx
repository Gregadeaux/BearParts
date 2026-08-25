import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ogMeta } from "@/lib/og";
import { getProfile } from "@/services/profiles.service";
import { listOrderItems } from "@/services/bom.service";
import { AppShell } from "@/components/layout/app-shell";
import { OrderList } from "@/components/orders/order-list";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const admin = createAdminClient();
    const [{ count: toOrder }, { count: ordered }] = await Promise.all([
      admin.from("bom_items").select("id", { count: "exact", head: true }).eq("status", "to_order"),
      admin.from("bom_items").select("id", { count: "exact", head: true }).eq("status", "ordered"),
    ]);
    return ogMeta("Orders", `${toOrder ?? 0} to order · ${ordered ?? 0} on the way`);
  } catch {
    return ogMeta("Orders", "Vendor order lists");
  }
}

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
