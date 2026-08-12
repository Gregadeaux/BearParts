import { createClient } from "@/lib/supabase/server";
import { listProfiles, getProfile } from "@/services/profiles.service";
import { AppHeader } from "@/components/layout/app-header";
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
    <>
      <AppHeader
        userName={profile?.display_name ?? "Teammate"}
        userAvatar={profile?.avatar_url ?? null}
      />
      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <h1 className="text-lg font-semibold">New part</h1>
        <NewPartForm team={team} />
      </main>
    </>
  );
}
