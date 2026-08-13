import { createClient } from "@/lib/supabase/server";
import { listParts } from "@/services/parts.service";
import { getProfile } from "@/services/profiles.service";
import { AppHeader } from "@/components/layout/app-header";
import { KanbanBoard } from "@/components/parts/kanban-board";

export default async function QueuePage() {
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
    <>
      <AppHeader
        userName={profile?.display_name ?? "Teammate"}
        userAvatar={profile?.avatar_url ?? null}
      />
      <main className="mx-auto max-w-6xl p-4">
        <KanbanBoard initialParts={parts} userId={user.id} />
      </main>
    </>
  );
}
