import { createClient } from "@/lib/supabase/server";
import { listParts } from "@/services/parts.service";
import { getProfile } from "@/services/profiles.service";
import { AppShell } from "@/components/layout/app-shell";
import { KanbanBoard } from "@/components/parts/kanban-board";
import { ArchivedSheet } from "@/components/parts/archived-sheet";
import { NewPartButton } from "@/components/parts/new-part-button";

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
