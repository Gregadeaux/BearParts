import { createClient } from "@/lib/supabase/server";
import { listProfiles, getProfile } from "@/services/profiles.service";
import { AppShell } from "@/components/layout/app-shell";
import { NewPartForm } from "@/components/parts/new-part-form";

export default async function NewPartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [team, profile] = await Promise.all([
    listProfiles(supabase),
    getProfile(supabase, user.id),
  ]);

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title="New part"
    >
      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <NewPartForm team={team} />
      </main>
    </AppShell>
  );
}
