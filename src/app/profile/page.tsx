export const metadata = { title: "Profile" };

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/services/profiles.service";
import { AppShell } from "@/components/layout/app-shell";
import { ProfileSettings } from "@/components/profile/profile-settings";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getProfile(supabase, user.id);

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title="Profile"
    >
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <p className="text-sm text-muted-foreground">Your account and feature settings.</p>
        <ProfileSettings
          displayName={profile?.display_name ?? ""}
          avatarUrl={profile?.avatar_url ?? null}
          email={user.email ?? null}
          experimentalFeatures={Boolean(profile?.experimental_features)}
        />
      </main>
    </AppShell>
  );
}
