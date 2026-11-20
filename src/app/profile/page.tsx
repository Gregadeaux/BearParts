export const metadata = { title: "Profile" };

import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/guards";
import { getProfile } from "@/services/profiles.service";
import { AppShell } from "@/components/layout/app-shell";
import { ProfileSettings } from "@/components/profile/profile-settings";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, viewer] = await Promise.all([getProfile(supabase, user.id), getViewer()]);

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
          role={viewer?.role ?? null}
          experimentalFeatures={Boolean(profile?.experimental_features)}
        />
      </main>
    </AppShell>
  );
}
