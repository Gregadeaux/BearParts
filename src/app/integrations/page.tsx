import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/services/profiles.service";
import { hasConnection } from "@/services/onshape/oauth";
import { isOnshapeConfigured, isOnshapeMock } from "@/services/onshape/config";
import { AppShell } from "@/components/layout/app-shell";
import { OnshapeConnectionCard } from "@/components/onshape/connection-card";

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, connected] = await Promise.all([
    getProfile(supabase, user.id),
    hasConnection(supabase, user.id),
  ]);

  return (
    <AppShell
      userName={profile?.display_name ?? "Teammate"}
      userAvatar={profile?.avatar_url ?? null}
      title="Integrations"
    >
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Connect outside tools to your BearParts account.
        </p>
        <OnshapeConnectionCard
          connected={connected}
          configured={isOnshapeConfigured()}
          mock={isOnshapeMock()}
        />
      </main>
    </AppShell>
  );
}
