import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ogMeta } from "@/lib/og";
import { listParts } from "@/services/parts.service";
import { getProfile } from "@/services/profiles.service";
import { AppShell } from "@/components/layout/app-shell";
import { KanbanBoard } from "@/components/parts/kanban-board";
import { ArchivedSheet } from "@/components/parts/archived-sheet";
import { NewPartButton } from "@/components/parts/new-part-button";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const admin = createAdminClient();
    const [{ count: open }, { count: cutting }] = await Promise.all([
      admin
        .from("parts")
        .select("id", { count: "exact", head: true })
        .not("status", "in", '("done","rejected")')
        .is("archived_at", null),
      admin
        .from("parts")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_progress")
        .is("archived_at", null),
    ]);
    return ogMeta(
      "Board",
      `${open ?? 0} part${open === 1 ? "" : "s"} in the fab pipeline · ${cutting ?? 0} on machines now`,
    );
  } catch {
    return ogMeta("Board", "The fab queue pipeline");
  }
}

export default async function BoardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware redirects

  const [parts, profile] = await Promise.all([
    listParts(supabase),
    getProfile(supabase, user.id),
  ]);

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title="Board"
      action={<NewPartButton />}
    >
      <main className="space-y-3 p-4">
        <div className="flex justify-end">
          <ArchivedSheet />
        </div>
        <KanbanBoard initialParts={parts} />
      </main>
    </AppShell>
  );
}
